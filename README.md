# Mailroom

Mailroom is a small email workspace. You use it to write messages, send them to one person or to a whole list, reuse the same letter later, and see whether people received and opened it.

It is meant for teams who send the same kinds of emails often — invitations, updates, newsletters — and want that work in one place instead of mixing it with a personal inbox.

The app is available in English, Azerbaijani, Russian, and Georgian. Switch the language from the menu at the top of the screen.

## What you can do

### Create an account and sign in

You can register on your own. After you enter your name, email, and password, a short code is sent to your inbox. Enter that code once and the account is ready.

If you already have an account, sign in with your email and password. You can also reset a forgotten password from the sign-in screen.

### Send a single email

Open **Send Email** to write a one-off message.

You can:

- Choose who it is from (a saved sender address)
- Add To, Cc, and Bcc
- Write a subject and a formatted body
- Place images in the letter (click where the picture should sit, then add it; drag to move it later)
- Attach files such as PDFs — those go with the email, not inside the page layout
- Send now, or schedule a time
- Include an unsubscribe link when the message is for a mailing list

### Run a campaign

**Campaigns** are for sending the same letter to many people.

You keep a list of contacts on the campaign, optionally pick a saved template, and send to everyone on that list. Extra files can be added at send time. If the template already has files, those go out with the campaign as well.

### Save templates

**Email Templates** are reusable letters. Save the subject, the HTML body, images, and file attachments once, then use them in campaigns.

When you edit a template you can:

- Preview how it will look
- Edit the layout visually (move images by dragging)
- Edit the HTML if you prefer to work in code
- Add or remove attached files (add and delete only — files are not placed in the letter itself)

### Keep a contact book

**Saved Contacts** is an address book. Add people once, then pick them when you build a campaign instead of typing emails again.

### Look back at what was sent

**Email History** is a log of outgoing mail. You can open a message, see who it went to, and send it again if you need to.

**Analytics** shows how campaigns performed in the last 30 days: how many emails went out, how many were delivered, and how many were opened. The **Contacts** column counts unique people, not repeat sends. If the same two people received a letter six times, Contacts shows **2**.

**Unsubscribes** lists addresses that opted out, so you do not write to them again by mistake.

### Set up sending

Before mail can leave the app, someone with access should configure:

- **Email Delivery** — the mailbox/server used to send
- **Sender addresses** — the From names and emails that appear to recipients

Until this is set, you can still write templates and campaigns; sending will wait on delivery being configured.

## How to run it

You need three things on your computer:

1. [Node.js](https://nodejs.org/) version 20 or newer
2. [Docker](https://www.docker.com/) (used only to run a local database)
3. This project folder

Then, in a terminal, from the project folder:

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npx prisma generate --schema apps/api/prisma/schema.prisma
npm run dev
```

What those steps do:

1. Copy the example settings into a local `.env` file.
2. Start the database in the background.
3. Install the app.
4. Prepare the database tables.
5. Start the app.

When it is running, open **http://localhost:5173** in your browser.

A first admin account is created automatically:

- Email: `admin@mailroom.local`
- Password: `Admin123`

You can also create your own account from the **Sign up** link on the sign-in page.

To stop the app, press `Ctrl+C` in the terminal. To stop the database: `docker compose down`.
