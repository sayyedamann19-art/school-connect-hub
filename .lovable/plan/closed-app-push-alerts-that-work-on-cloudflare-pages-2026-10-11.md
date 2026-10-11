# Closed-app push alerts that work on Cloudflare Pages

## The problem today
The sender in the current code only works on Lovable's hosting, because it needs two things Cloudflare doesn't have:
1. The **master backend key**, used to read every parent's device list.
2. **Lovable's messaging gateway key**, used to talk to Firebase.

## The proposal (short version)
- Your Cloudflare site talks to Firebase directly, using a Firebase key stored as an **encrypted Cloudflare secret**.
- Instead of sending one alert per phone, every parent who turns alerts on joins one Firebase **"school-updates" group** (Firebase calls this a topic). Publishing an update sends **one message to that group**.
- Because of the group, the server never has to read other people's device lists, so the master backend key isn't needed at all.

```text
Parent taps "Alert me"  ->  phone gets a device code  ->  our server (signed-in parent)
                                                          -> adds it to the "school-updates" group
Admin/teacher publishes ->  database marks "alert sent" once (only the first time)
                         ->  our server sends 1 message to the group  ->  every subscribed phone
```

## How each requirement is met
- **No master key, no privileged secrets in the browser:** the only private value is the Firebase service account key. It lives in Cloudflare as an encrypted secret that only the server can read. It never goes into code, GitHub, wrangler.jsonc, or any public variable.
- **Who can subscribe:** only a signed-in parent. The server reads the user from their verified login session, then checks their role and their "update alerts" setting in the database before adding the device to the group.
- **Who can trigger an alert:** only an admin, or the teacher who wrote the update. This is checked by the existing rules plus the existing role check.
- **No duplicates:** a new `push_sent_at` mark on each update is claimed in one database step, and only while it is still empty. Editing, re-publishing, or two clicks at the same moment can't send a second alert. Drafts and hidden updates never send.
- **Turning alerts off or signing out:** the device is removed from the group and deleted from `push_tokens`. The existing owner-only security rules stay as they are.
- **Lovable-hosted site keeps working:** if the Cloudflare secret is missing, the sender falls back to the current gateway route.

## Changes required
1. **Database (one small migration):**
   - Add `push_sent_at` to `school_updates`.
   - Add a secure helper, `claim_update_push(update_id)`. It returns the title, body and category only if the caller is an admin or the update's author, the update is published, and no alert has been sent yet. It sets the mark in the same step.
   - No change to existing rules or records.
2. **`src/lib/push.functions.ts`:**
   - Sign a short-lived Google access token from the Cloudflare secret, using the server's built-in crypto with no new library.
   - Send to the topic through the Firebase v1 API.
   - Subscribe and unsubscribe devices to and from the topic.
   - Remove the master-key read path.
3. **`src/lib/updates.functions.ts`:**
   - The four publish actions call `claim_update_push` instead of the current check that reads `first_published_at` before publishing.
4. **Account preference toggle:** when a parent turns alerts off, their devices are removed from the group. Turning alerts back on adds them again.
5. **Tests:** check that a second claim returns nothing, so there are no duplicates, and that a draft can't be claimed.

## Where secrets and settings live
| Value | Public? | Where it goes |
|---|---|---|
| Firebase service account key (JSON) | **Secret** | Cloudflare dashboard → your project → Settings → Variables and Secrets → **Encrypt**, saved as `FIREBASE_SERVICE_ACCOUNT` |
| Firebase web API key | Public | Cloudflare build variable `VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY` |
| Firebase project ID | Public | `VITE_..._PROJECT_ID` |
| Firebase App ID | Public | `VITE_..._APP_ID` |
| Web Push (VAPID) public key | Public | `VITE_..._VAPID_KEY` |

You type these into Cloudflare yourself. Nothing is pasted into chat. The Lovable Firebase connect card becomes optional and is only needed if you also want alerts on the Lovable-hosted site.

## Cost
- Firebase Cloud Messaging: **free**, with no message limit.
- Cloudflare secrets and variables: free.
- Each publish makes about 2 outside calls, which is well within Cloudflare's free plan, even with thousands of parents. This is the main reason for using one group instead of one message per phone, because the free plan caps outside calls per request at 50.
- Database: no measurable cost.

## Deployment steps (for you, after I build it)
1. Create a free Firebase project → add a Web app → copy the API key, project ID and App ID.
2. Firebase → Project settings → Cloud Messaging → Web Push certificates → **Generate key pair** → copy the public key.
3. Firebase → Project settings → Service accounts → **Generate new private key**. A JSON file downloads. Keep it private.
4. In Cloudflare, add the 4 public values as variables and the JSON as an **encrypted** secret named `FIREBASE_SERVICE_ACCOUNT`.
5. Redeploy from GitHub (your normal flow).
6. Test it:
   - As a parent on a phone, install the app to the home screen (required on iPhone) and tap "Alert me even when the app is closed". Then close the app.
   - As a teacher, publish an update. The parent's phone should get one alert.
   - Publish the same update again. There should be no second alert.

## Honest limits
- I can't see your Cloudflare account, so the live test has to be done by you, or with you, after you redeploy.
- Every subscribed parent in the group receives every published update. That matches today's rule that all parents see all published updates. If you later want alerts only for certain classes, we can switch to one group per class.
- iPhone alerts only work once the app is installed to the home screen (iOS 16.4 or newer).
