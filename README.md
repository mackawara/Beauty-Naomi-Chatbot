# Beauty-Naomi-Chatbot

A WhatsApp chatbot for booking salon services. Bookings are held in the
[scheduler API](https://github.com/mackawara/scheduler), the same service behind
the web portal, so a customer can book in either place and manage the booking
from either.

## Booking over WhatsApp

Booking runs as a **WhatsApp Flow** — a form the customer fills without leaving
the chat. Every screen is served live from the scheduler:

1. **Service** — the salon's real catalog, with duration and price.
2. **Time** — a day picker, then the times actually free that day. Availability
   is merged across every stylist qualified for the service, so the customer is
   offered every slot the salon can take rather than one person's diary.
3. **Details** — name; the phone number comes from the chat.
4. **Confirm** — the slot is held *before* this screen, so it is theirs while
   they check. The hold expires on its own if they walk away.

The Flow definition to publish in the Meta dashboard is
[flows/booking-flow.json](./flows/booking-flow.json). Requests are end-to-end
encrypted: Meta encrypts a one-off AES key with our RSA public key, and
[flowCrypto.ts](./src/Controllers/Whatsapp/Flows/flowCrypto.ts) decrypts it and
signs the reply back. Set the Flow's endpoint to
`https://<your-host>/whatsapp/flows`.

Because Meta never tells the endpoint who it is talking to, each Flow is opened
with a token bound to the customer's number in Redis, and every screen reads the
customer back out of that session.

## Managing a booking over WhatsApp

Replying *bookings* (or picking **View My Bookings**) sends a six-digit code to
the customer's number and, once verified, lists their appointments with actions
to move or cancel them. Rescheduling picks a day and then a time, keeping the
customer with the stylist they booked. Verification is the same phone identity
the portal uses, so a booking made on the web is manageable here and vice versa.

Text shortcuts: *hi* / *menu*, *book*, *bookings*, *help*.

## Notifications

The scheduler posts signed events to `POST /scheduler/events` — confirmations,
reschedules, cancellations, 24-hour and 2-hour reminders, waitlist openings, and
verification codes — and this service relays each one to the customer on
WhatsApp. Signatures are checked against the raw request body, and event ids are
recorded in Redis so a retried delivery never messages a customer twice.

## Setup

```bash
yarn install
cp .env.example .env
```

Fill in `.env`. `SCHEDULER_API_KEY` is the **secret** key (`sk_sched_...`) from
the scheduler's seed script — this service is server-side, so it may hold it.
The scheduler's `BEAUTY_NAOMI_WEBHOOK_URL` should point at
`https://<this-host>/scheduler/events`, and its webhook signing secret goes in
`SCHEDULER_WEBHOOK_SECRET`.

Generate the Flow key pair, upload the public half in the Meta dashboard, and
keep the private half in `WHATSAPP_FLOW_PRIVATE_KEY`:

```bash
openssl genrsa -des3 -out private.pem 2048
openssl rsa -in private.pem -outform PEM -pubout -out public.pem
```

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
