# Beauty-Naomi-Chatbot
A whatsapp chatbot for booking services

# Ngrok setup
Run the command ngrok config add-authtoken 'token'
Run the ngrok script
Note: Only one person can run it a time

# Whatsapp Webhook Setup
Expose a public HTTPS webhook endpoint
      Start a local tunnel using ngrok to generate a public HTTPS URL
      Copy the generated HTTPS URL from ngrok
      Open the Facebook (Meta) Developer Dashboard
      Select the relevant app
      Navigate to WhatsApp → Configuration → Webhooks
      Paste the ngrok HTTPS URL into the Callback URL field
      Append the project’s webhook route to the URL (e.g. /whatsapp)
      Save the configuration and confirm the endpoint is reachable externally
Implement the verification handshake
      Generate a verification token in the application
      Enter the same verification token in the Facebook Developer Dashboard of your app
      Handle the verification request parameters (mode, verify_token, challenge) in the project
      Validate the received verify token against the configured value
      Respond with the challenge value to confirm successful verification

Complete webhook verification
      Click Verify and Save in the Facebook Developer Dashboard
      Confirm the webhook status shows as verified

Configure event subscriptions after verification e.g messages, flows and catalogue
Ensure incoming webhook payloads are accepted and acknowledged
Manage all tokens and secrets using environment variables which is the .env file
Confirm the endpoint is stable and has error handling and ready for production traffic

# Setting up Redis on Windows (On Mac you run it natively)
Pull Redis Image
Open Docker Desktop (make sure it's running)
Go to the "Images" tab on the left sidebar
Click "Pull" in the top right corner
Type redis:alpine in the search box
Click "Pull" to download the Redis image

Then
Go to the "Containers" tab
Click "Run" button
In the popup window:
Image: redis:alpine (should auto-fill)
Container name: redis-dev (or any name you like)
Find the "Ports" section
Change 6379:6379 to 6379:6379
(This means: your computer port 6379 → Redis port 6379)
Click Run

# Setting Up Docker for Beauty Naomi Chatbot

First, make sure Docker Desktop is running on your computer.

Second, run this command to set up the container

docker-compose up -d

The -d flag runs containers in the background.

Then make sure redis is running and change the redis host in the env file to 
REDIS_HOST=redis

Then also start running ngrok with the command yarn start:ngrok in your vs terminal of the project

Fourth, verify everything is working:

Finally, test the app at http://localhost:3000
To stop all containers, run:

To stop containers but keep them (can start again):
  docker-compose  stop

To stop and delete the container use
 docker-compose  down

Use individual containers only if you need to debug a specific container or test something in isolation.

## Checking if Everything is Running

Open Docker Desktop and go to the Containers tab. You should see three containers running.

Or run this command in terminal:

docker ps


# WhatsApp Flows data endpoint
The booking Flow loads dates and time slots live through `data_exchange`, so WhatsApp calls our endpoint at `POST /whatsapp/flows`. Every request is encrypted and signed.

1. Generate a key pair (keep the private key secret):
   ```bash
   openssl genrsa -des3 -out flow_private.pem 2048
   openssl rsa -in flow_private.pem -outform PEM -pubout -out flow_public.pem
   ```
2. Upload the public key for the business phone number:
   ```bash
   curl -X POST "https://graph.facebook.com/v21.0/$WHATSAPP_PHONE_NUMBER_ID/whatsapp_business_encryption" \
     -H "Authorization: Bearer $WHATSAPP_SYSTEM_TOKEN" \
     --data-urlencode "business_public_key=$(cat flow_public.pem)"
   ```
3. Set in `.env`:
   - `WHATSAPP_FLOW_PRIVATE_KEY`: the PEM contents (newlines may be written as `\n` on one line)
   - `WHATSAPP_FLOW_PRIVATE_KEY_PASSPHRASE`: the passphrase used above
   - `WHATSAPP_APP_SECRET`: Meta app secret (App settings → Basic), used to verify `X-Hub-Signature-256`
4. In Flow Builder set the endpoint URI to `https://<public host>/whatsapp/flows` and run **Health check**.

The endpoint answers `ping` health checks, acknowledges client error notifications, returns `432` for a bad signature and `421` when a request cannot be decrypted (WhatsApp then re-fetches the public key). Screen logic is registered per screen and `trigger` in `src/Controllers/Whatsapp/flows/flowRouter.ts`.

Run the tests with `yarn test`.


# Scheduler notifications (reminders, cancellations, reschedules)
The in-house scheduler POSTs signed events to `POST /scheduler/events`. Configure its app webhook URL as `https://<public host>/scheduler/events` (`BEAUTY_NAOMI_WEBHOOK_URL` when seeding the scheduler) and set `SCHEDULER_WEBHOOK_SECRET` here to the signing secret the scheduler seed prints.

- Requests with a bad `x-scheduler-signature` are rejected with `401`.
- Each event id is processed once (Redis `scheduler-event:<id>`, 7 days), so redeliveries do not message twice.
- `BOOKING_CANCELLED` / `BOOKING_RESCHEDULED` also update the local booking; `BOOKING_CREATED` is ignored (the Flow already confirmed it).
- A `5xx` is returned when sending fails so the scheduler retries after 1, 5 and 15 minutes.

Reminders usually arrive outside WhatsApp's 24-hour customer service window, so all of these are sent as **approved message templates**. Create them in WhatsApp Manager (category *Utility*, language `en_US` or set `WHATSAPP_TEMPLATE_LANGUAGE`). Names can be overridden with the env vars shown.

| Event | Template (env var) | Body |
| --- | --- | --- |
| `REMINDER_24H`, `REMINDER_2H` | `booking_reminder` (`WHATSAPP_TEMPLATE_REMINDER`) | Hi {{1}}, this is a reminder of your {{2}} appointment at Beauty Naomi on {{3}} at {{4}}. Reply to this message if you need to make a change. |
| `BOOKING_CANCELLED` | `booking_cancelled` (`WHATSAPP_TEMPLATE_CANCELLED`) | Your {{1}} appointment on {{2}} at {{3}} has been cancelled. Reply *hi* to book a new time. |
| `BOOKING_RESCHEDULED` | `booking_rescheduled` (`WHATSAPP_TEMPLATE_RESCHEDULED`) | Your {{1}} appointment has been moved to {{2}} at {{3}}. Reply to this message if that doesn't suit you. |
