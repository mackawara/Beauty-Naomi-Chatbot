# Local smoke test: WhatsApp booking with the in-house scheduler

This walks through the whole booking journey on one machine:

**customer orders from the catalog → booking Flow (dates → times → confirm) → booking in the scheduler → visible and manageable in the admin portal → cancellation reaches the bot.**

You need **no real WhatsApp number** for this: webhooks are simulated with `curl` and the Flow is driven by `yarn smoke:flow`, which encrypts requests exactly like the WhatsApp app. Messages the bot tries to *send* will fail (fake Meta token) and show up as log lines instead — that is expected. Section 8 covers testing on a real phone.

## What you need

- Node.js 22+, Yarn, Docker, `openssl`, `curl`
- The three repos side by side:
  ```
  scheduler/              (mackawara/scheduler)
  Beauty-Naomi-Chatbot/   (this repo)
  Portal-Beauty-Naomi/    (admin portal)
  ```

| Service | URL |
| --- | --- |
| Scheduler API | http://localhost:4100 |
| Chatbot | http://localhost:3000 |
| Admin portal | http://localhost:5173 |
| MongoDB (replica set `rs0`) | localhost:27017 |
| Redis | localhost:6379 |

## 1. Start MongoDB and Redis

The scheduler's compose file starts a single-node replica set (transactions need one) and Redis. Both apps share them.

```bash
cd scheduler
docker compose up -d
```

Don't also start this repo's `docker-compose.yml`; its Redis would clash on port 6379.

## 2. Start the scheduler

```bash
cd scheduler
npm install
cp .env.example .env
# put two fresh secrets in .env:
#   PII_ENCRYPTION_KEY=$(openssl rand -base64 32)
#   JWT_SECRET=$(openssl rand -hex 32)

BEAUTY_NAOMI_ADMIN_PASSWORD='local-test-password-123' \
BEAUTY_NAOMI_WEBHOOK_URL='http://localhost:3000/scheduler/events' \
npm run seed:beauty-naomi
```

The seed prints two values **once**. Copy them:

```
API key (save now): sk_sched_...                  → chatbot SCHEDULER_API_KEY
Webhook signing secret (save now): sk_sched_...   → chatbot SCHEDULER_WEBHOOK_SECRET
```

(Lost them? Re-run the seed with `ROTATE_API_KEY=true ROTATE_WEBHOOK_SECRET=true`.)

Then, in two terminals:

```bash
npm run dev      # API on :4100
npm run worker   # delivers webhook events (confirmations, cancellations, reminders)
```

Check: `curl localhost:4100/health/ready` → `{"status":"ready",...}`.

The seed creates the **Hair Wash** service (catalog retailer ID `hair-wash`) and **Naomi** working Mon–Fri 09:00–17:00, Sat 09:00–14:00.

## 3. Start the chatbot

Create a throwaway key pair for the Flow endpoint:

```bash
cd Beauty-Naomi-Chatbot
openssl genrsa -aes256 -passout pass:local-flow-pass -out flow_private.pem 2048
openssl rsa -in flow_private.pem -passin pass:local-flow-pass -pubout -out flow_public.pem
```

Create `.env` (values in `<>` come from step 2):

```bash
cat > .env <<EOF
APP_ENV=local
PORT=3000
MONGODB_URI=mongodb://localhost:27017/beauty_naomi?replicaSet=rs0
REDIS_HOST=127.0.0.1
REDIS_HOST_PORT=6379
WHATSAPP_WEBHOOK_VERIFICATION_TOKEN=local-verify
WHATSAPP_PHONE_NUMBER_ID=000000000000000
WHATSAPP_SYSTEM_TOKEN=fake-token
WHATSAPP_APP_SECRET=local-app-secret
WHATSAPP_BOOKING_FLOW_ID=000000000000000
WHATSAPP_FLOW_PRIVATE_KEY="$(awk '{printf "%s\\n", $0}' flow_private.pem)"
WHATSAPP_FLOW_PRIVATE_KEY_PASSPHRASE=local-flow-pass
SCHEDULER_API_URL=http://localhost:4100
SCHEDULER_API_KEY=<API key>
SCHEDULER_WEBHOOK_SECRET=<webhook signing secret>
EOF

yarn install
yarn dev
```

Expected log: `[MONGOOSE] Database connected successfully`, both scheduler health checks, `Server running on port 3000`.

Check the Flow endpoint (encryption + signature):

```bash
yarn smoke:flow ping
# ── ping → (no screen)
#    status: "active"
```

> With `APP_ENV` set, the bot **flushes Redis on every start** (existing behaviour). That drops open Flow tokens, so start a new order after restarting the bot. The scheduler only uses Redis as a cache, so it is unaffected.

## 4. Start the admin portal

```bash
cd Portal-Beauty-Naomi
yarn install
VITE_SCHEDULER_API_URL=http://localhost:4100 VITE_APP_SLUG=beauty-naomi yarn dev
```

Open http://localhost:5173 and log in as `admin@beautynaomi.local` / `local-test-password-123`.

- **Services**: *Hair Wash* shows catalog ID `hair-wash`. Give it a price so the Flow shows one (e.g. 15.00).
- **Staff & hours**: Naomi's weekly hours are listed. *Edit hours* lets you change them.
- **Schedule**: pick a date; the grid shows open slots. Click an open slot → *Block*. Keep this page open.

## 5. Simulate the customer in WhatsApp

**"hi" → main menu**

```bash
curl -s -X POST localhost:3000/whatsapp/messages -H 'content-type: application/json' -d '{
  "object": "whatsapp_business_account",
  "entry": [{ "id": "1", "changes": [{ "field": "messages", "value": {
    "messaging_product": "whatsapp",
    "contacts": [{ "profile": { "name": "Smoke Tester" }, "wa_id": "263770000123" }],
    "messages": [{ "from": "263770000123", "id": "wamid.hi", "timestamp": "1760000000",
                   "type": "text", "text": { "body": "hi" } }]
  }}]}]
}'
```

Expect `{"success":true}` and a `[WHATSAPP-MESSAGING]` log line (the send fails with the fake token — fine).

**Order "Hair Wash" from the catalog → booking Flow sent**

```bash
curl -s -X POST localhost:3000/whatsapp/messages -H 'content-type: application/json' -d '{
  "object": "whatsapp_business_account",
  "entry": [{ "id": "1", "changes": [{ "field": "messages", "value": {
    "messaging_product": "whatsapp",
    "contacts": [{ "profile": { "name": "Smoke Tester" }, "wa_id": "263770000123" }],
    "messages": [{ "from": "263770000123", "id": "wamid.order", "timestamp": "1760000001",
                   "type": "order", "order": { "catalog_id": "local", "text": "",
                   "product_items": [{ "product_retailer_id": "hair-wash", "quantity": "1",
                                       "item_price": "15", "currency": "USD" }] } }]
  }}]}]
}'
```

Expect in the bot log: `Creating appointment BN-<n>` and `Order processed ... BN-<n>`. The Flow message the bot tried to send carries a `flow_token`; read it from Redis:

```bash
redis-cli --scan --pattern 'flow:*'
# flow:2b4820a2-23c9-48d4-b395-9c03e1023787   ← the part after "flow:" is the token
```

Try the edge cases too: `"product_retailer_id": "nope"` (unknown service) or two different items (one service at a time) — both log a reply and create no token.

## 6. Book through the Flow

One command runs INIT → first date → first time → confirm:

```bash
yarn smoke:flow journey <flow_token> "Smoke Tester"
```

Or step by step, like a customer:

```bash
yarn smoke:flow init    <flow_token>                       # BOOK screen: dates + first date's times
yarn smoke:flow date    <flow_token> 2026-10-20            # times reload for that date
yarn smoke:flow confirm <flow_token> 2026-10-20 <slot id>  # slot id = the "id=" printed next to a time
```

Expected:

- `INIT` shows the service, price, dates like `Tue 20 Oct · 28 times`, and that date's times.
- The time you **blocked in the portal is not listed**. Unblock it in the portal, run `date` again — it's back.
- `confirm` → `SUCCESS` with `summary: "Hair Wash\nTue 20 Oct at 09:00\nRef BN-<n>"`.
- Running the same `confirm` again → `SUCCESS` again, still **one** booking (idempotent).
- Confirming a time someone else just took → `BOOK` with "Sorry, that time was just taken" and fresh times.

Check the results:

```bash
docker compose -f ../scheduler/docker-compose.yml exec mongodb \
  mongosh beauty_naomi --quiet --eval 'db.bookings.find({}, {bookingId:1, status:1, bookingTime:1, _id:0}).toArray()'
# → status: 'CONFIRMED', bookingTime: '09:00'
```

In the portal, refresh **Schedule** for that date: the slot is **Booked**; click it to see the customer. **Bookings** lists it too.

## 7. Cancel / reschedule from the portal

In **Bookings**, expand the booking → *Cancel booking* (or *Reschedule* → pick a date and time).

Expected within ~5 s (the worker's poll interval):

- The slot is **Open** again in Schedule and offered again by `yarn smoke:flow date ...`.
- Bot log: `[SCHEDULER-EVENTS] Failed to handle BOOKING_CANCELLED ... Template booking_cancelled failed` — in offline mode the WhatsApp send fails, the bot answers 500 and the scheduler retries after 1, 5 and 15 minutes. With real credentials and approved templates the customer gets the message instead.
- The bot's booking is `CANCELLED` (or has the new date/time after a reschedule).

## 8. Optional: real phone

1. Expose the bot: `ngrok http 3000`.
2. Meta app → WhatsApp → Configuration → Webhooks: callback `https://<ngrok>/whatsapp/messages`, verify token = `WHATSAPP_WEBHOOK_VERIFICATION_TOKEN`; subscribe to `messages`.
3. Put the real `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_SYSTEM_TOKEN` and `WHATSAPP_APP_SECRET` in `.env`.
4. Upload `flow_public.pem` and create the Flow from `flows/booking.json` with endpoint `https://<ngrok>/whatsapp/flows` (see [flows/README.md](../flows/README.md)). Run the Flow Builder health check, then put the Flow ID in `WHATSAPP_BOOKING_FLOW_ID`. While testing you can keep the Flow unpublished and use **Preview**.
5. Link a catalog product to the service: set its retailer ID on the service in the portal.
6. From a test phone: send *hi* → *Make A Booking* → order the product → *Pick a time*.

## Checklist

- [ ] `yarn smoke:flow ping` → `status: "active"`
- [ ] Order webhook → `BN-<n>` created as `PENDING_SLOT`, a `flow:*` token in Redis
- [ ] Flow `INIT` lists dates with times; picking a date reloads times
- [ ] A slot blocked in the portal is not offered; unblocking brings it back
- [ ] Confirm → `SUCCESS`; booking `CONFIRMED` in the bot DB; slot **Booked** in the portal
- [ ] Repeating confirm doesn't create a second booking
- [ ] Cancel in the portal → slot open again, bot booking `CANCELLED`, bot log shows the cancellation event

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Bot exits: `Scheduler API is not live` | Scheduler not running on 4100, or `SCHEDULER_API_URL` points at 4000 (that's the bot's own port). |
| Scheduler: `Transaction numbers are only allowed on a replica set` | MongoDB isn't a replica set — use the scheduler's compose file (it runs `rs.initiate`). |
| `smoke:flow` → `HTTP 432` | `WHATSAPP_APP_SECRET` differs between the bot and the script (both read `.env`; restart the bot after editing it). |
| `smoke:flow` → `HTTP 421` | The key in `.env` or its passphrase doesn't match what the bot loaded — restart the bot. |
| `INIT` says "This booking link has expired" | The token is older than an hour, or the bot restarted (Redis flush). Send the order webhook again. |
| `INIT` says "fully booked" | No working hours in the next 14 days, everything blocked, or the service's resource type matches no staff member. |
| Order replies "couldn't find that service" | No active service has that `catalogRetailerId` — set it in the portal. |
| Portal login fails / CORS | Check `VITE_SCHEDULER_API_URL` and `VITE_APP_SLUG=beauty-naomi`, and that the scheduler is up. |
