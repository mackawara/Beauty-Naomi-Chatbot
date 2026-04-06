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
