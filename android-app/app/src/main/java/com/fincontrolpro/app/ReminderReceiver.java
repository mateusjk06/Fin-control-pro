package com.fincontrolpro.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public final class ReminderReceiver extends BroadcastReceiver {
    static final String PREFS = "fincontrol_local_reminders";
    static final String CHANNEL = "fincontrol_due_dates_v1";
    static final String ACTION_CHECK = "com.fincontrolpro.app.CHECK_DUE";
    static final String ACTION_BOOT = "android.intent.action.BOOT_COMPLETED";
    static final String ACTION_PACKAGE_REPLACED = "android.intent.action.MY_PACKAGE_REPLACED";

    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (ACTION_CHECK.equals(action) || ACTION_BOOT.equals(action) || ACTION_PACKAGE_REPLACED.equals(action)) {
            checkAndNotify(context);
            scheduleNext(context);
        }
    }

    static void saveSchedule(Context context, String json) {
        try {
            JSONObject data = new JSONObject(json);
            String uid = data.optString("uid", "");
            JSONArray entries = data.optJSONArray("entries");
            if (uid.isEmpty() || entries == null) return;
            SharedPreferences pref = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            pref.edit().putString("uid", uid).putString("entries", entries.toString()).apply();
            scheduleNext(context);
            checkAndNotify(context);
        } catch (Exception ignored) { }
    }

    static void clearSchedule(Context context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .remove("uid").remove("entries").apply();
        AlarmManager manager = (AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        if(manager != null) manager.cancel(pendingIntent(context));
    }

    private static PendingIntent pendingIntent(Context context) {
        Intent intent = new Intent(context, ReminderReceiver.class).setAction(ACTION_CHECK);
        return PendingIntent.getBroadcast(context, 701, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void scheduleNext(Context context) {
        AlarmManager manager = (AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        if(manager == null) return;
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, 9);
        next.set(Calendar.MINUTE, 0);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DAY_OF_MONTH, 1);
        // Inexact alarm: works without special exact-alarm permission; Android may delay it.
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pendingIntent(context));
    }

    static void checkAndNotify(Context context) {
        SharedPreferences pref = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String uid = pref.getString("uid", "");
        if(uid.isEmpty()) return;
        if(Build.VERSION.SDK_INT >= 33 &&
                context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        try {
            JSONArray items = new JSONArray(pref.getString("entries", "[]"));
            SimpleDateFormat date = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            date.setLenient(false);
            Calendar today = Calendar.getInstance();
            String todayKey = date.format(today.getTime());
            today.add(Calendar.DAY_OF_MONTH, 1);
            String tomorrowKey = date.format(today.getTime());

            Set<String> seen = new HashSet<>(pref.getStringSet("sent", new HashSet<>()));
            StringBuilder dueToday = new StringBuilder(), dueTomorrow = new StringBuilder();
            int todayCount = 0, tomorrowCount = 0;
            for(int i=0; i<items.length() && i<300; i++) {
                JSONObject item = items.optJSONObject(i);
                if(item==null)continue;
                String due = item.optString("date", "");
                String key = uid + ":" + todayKey + ":" + item.optString("id", String.valueOf(i)) + ":" + due;
                if(seen.contains(key))continue;
                String name = item.optString("title", "Vencimento");
                if(name.length()>65)name=name.substring(0,65);
                if(todayKey.equals(due)) {
                    todayCount++;
                    if(todayCount<=3)dueToday.append("\\n• ").append(name);
                    seen.add(key);
                } else if(tomorrowKey.equals(due)) {
                    tomorrowCount++;
                    if(tomorrowCount<=3)dueTomorrow.append("\\n• ").append(name);
                    seen.add(key);
                }
            }
            if(todayCount>0)showNotification(context, 4001,
                    todayCount==1?"Vencimento hoje":"Vencimentos hoje",
                    todayCount+" compromisso(s) vencem hoje"+dueToday, todayCount);
            if(tomorrowCount>0)showNotification(context, 4002,
                    tomorrowCount==1?"Vencimento amanhã":"Vencimentos amanhã",
                    tomorrowCount+" compromisso(s) vencem amanhã"+dueTomorrow, tomorrowCount);
            // Limit bookkeeping to recent dates so preferences do not grow indefinitely.
            Set<String> compact=new HashSet<>();
            for(String k:seen) if(k.startsWith(uid + ":" + todayKey + ":"))compact.add(k);
            pref.edit().putStringSet("sent", compact).apply();
        }catch(Exception ignored) { }
    }

    private static void showNotification(Context context, int id, String title, String body, int count) {
        NotificationManager manager = (NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if(manager==null)return;
        if(Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Vencimentos FinControl Pro",
                    NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Lembretes locais de contas e parcelas cadastradas");
            manager.createNotificationChannel(channel);
        }
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent click=PendingIntent.getActivity(context, 702, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder=Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(context, CHANNEL) : new Notification.Builder(context);
        builder.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(title)
                .setContentText(body.replace("\\n"," ").trim())
                .setStyle(new Notification.BigTextStyle().bigText(body.trim()))
                .setAutoCancel(true).setContentIntent(click).setNumber(count);
        manager.notify(id, builder.build());
    }
}
