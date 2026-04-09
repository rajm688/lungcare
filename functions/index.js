const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// Task schedule — IST times mapped to notification content
const SCHEDULE = {
  '06:30': {
    title: 'Morning Routine',
    body: 'SpO2 check, postural drainage, nasal saline wash'
  },
  '07:00': {
    title: 'Core & Breakfast',
    body: 'Belly breathing + pelvic tilts, then high-calorie breakfast'
  },
  '07:30': {
    title: 'Morning Walk',
    body: '20 min walk (pursed-lip breathing) + doorway chest stretch'
  },
  '09:00': {
    title: 'Morning Medication',
    body: 'Forocot G morning puff \u2014 wait 10-15 min. Rinse mouth after.'
  },
  '10:30': {
    title: 'Mid-Morning Snack',
    body: 'Nuts + groundnut chikki + coconut water \u2014 never skip!'
  },
  '13:00': {
    title: 'Lunch Time',
    body: 'Biggest meal \u2014 rice + sambar + dal + curd + ghee (650 kcal)'
  },
  '13:30': {
    title: 'Post-Lunch Check',
    body: 'Log SpO2 reading + 30 min rest. Sit upright, don\u2019t lie flat.'
  },
  '15:00': {
    title: 'Hydration Check',
    body: 'Target 2.5L by 4 PM \u2014 warm or room temp water only'
  },
  '16:00': {
    title: 'Afternoon Tasks',
    body: 'Afternoon snack + chin tuck exercises (10 reps \u00D7 3)'
  },
  '18:00': {
    title: 'Evening Routine',
    body: 'Aerobika 5 cycles + core + strength exercises'
  },
  '18:30': {
    title: 'Evening Walk',
    body: '20-30 min walk, then dinner before 8 PM'
  },
  '19:30': {
    title: 'Dinner Time',
    body: 'Eat before 8 PM \u2014 ragi roti + kurma + dal + ghee'
  },
  '20:15': {
    title: 'Post-Dinner Walk',
    body: '10 min walk. Don\u2019t lie flat for 45 min after eating.'
  },
  '21:00': {
    title: 'Night Medication',
    body: 'Forocot G night puff \u2014 wait 10-15 min. Rinse mouth after.'
  },
  '22:00': {
    title: 'Bedtime',
    body: 'Huff cough, clean devices, sleep \u2014 2 pillows, right side.'
  }
};

// Runs every 15 minutes (Gen 1 — already deployed)
exports.sendReminders = functionsV1.pubsub
  .schedule('*/15 * * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0');
    const key = `${h}:${m}`;

    const reminder = SCHEDULE[key];
    if (!reminder) return null;

    const snapshot = await db.collection('devices').where('uid', '!=', null).get();
    if (snapshot.empty) {
      console.log('No FCM tokens found — 0 devices registered');
      return null;
    }

    console.log(`Found ${snapshot.size} registered device(s) for reminder ${key}`);

    // Group by uid so each user only gets one notification even with multiple devices
    const sendPromises = snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const token = data.token;
      if (!token || !data.uid) { console.log(`Skipping ${doc.id}: no token or uid`); return; }

      try {
        await messaging.send({
          token,
          data: {
            title: reminder.title,
            body: reminder.body,
            tag: 'lungcare-' + key.replace(':', ''),
            icon: 'https://lungcare-721be.web.app/icons/icon-192.svg'
          },
          webpush: {
            headers: { Urgency: 'high', TTL: '300' }
          }
        });
        console.log(`Sent reminder to ${doc.id}: ${key} - ${reminder.title}`);
      } catch (err) {
        console.error(`FCM send error for ${doc.id}:`, err.code, err.message);
        if (
          err.code === 'messaging/registration-token-not-registered' ||
          err.code === 'messaging/invalid-registration-token'
        ) {
          await doc.ref.delete();
          console.log(`Deleted invalid token: ${doc.id}`);
        }
      }
    });

    const results = await Promise.all(sendPromises);
    console.log(`Reminder ${key} done — sent to ${snapshot.size} device(s)`);
    return null;
  });

