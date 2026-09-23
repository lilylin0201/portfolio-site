# Journal setup

Your site now has a weekly journal at **yoursite.com/journal**.

- It isn't linked from the menu, and search engines are told not to list it. Anyone you give the link to can read it.
- **Edit** and **New entry** ask for your password. After you enter it once, you stay logged in on that browser for 60 days. **Log out** is at the bottom of the week list.

## One-time setup in Vercel (about 5 minutes)

Open your project in the Vercel dashboard, then:

1. **Storage → Create → Blob.** Name it `journal-media` and choose **Public** access. Connect it to this project. This is where photos and videos go. It's free up to 1 GB and **doesn't count toward your deployment storage**.
2. **Storage → Create → Upstash (Redis).** Pick the **Free** plan and connect it to this project. This is where your writing goes.
3. **Settings → Environment Variables.** Add `JOURNAL_PASSWORD` with a long password only you know.
4. **Deployments → ⋯ on the latest one → Redeploy**, so the site picks up steps 1 to 3.

Then go to `/journal`, press **New entry**, and enter your password.

## How it works

- **New entry** opens this week's template: Main Achievements, To-do, and a heading for each day of the week. Change the week with the date picker under the title.
- **Save** saves the entry. **Edit** on any entry lets you change it, and **Cancel** throws away your changes.
- **Text styles** are fixed: Heading, Subheading, Body and Description (grey italics). There are also bold, italic, underline, strikethrough, alignment and bullet lists.
- **Photos.** Drag them onto the page or use the photo button. Photos you add together go two per row.
  - Drag a photo onto another single photo to put them side by side, or drag one out of a pair to split them. **One per row** does the same.
  - Drag the blue handle on a photo's right edge to resize it.
  - Large phone photos are shrunk before uploading.
- **Videos.** Use the video button to paste a YouTube, Vimeo, Loom or Google Drive link, or to upload a short clip (up to 100 MB).
- **Safety net.** While you write, a copy is kept in your browser. If the tab closes before you save, you'll be offered your writing back next time.
- **Storage stays lean.** Photos you remove, photos from a cancelled edit and photos in a deleted entry are all deleted from storage.
- **Copying over from Google Docs.** Pasting text keeps headings, bold and bullets. Photos don't carry over, so drag them in again.

## Trying it on your laptop

Run `pnpm dev` and open http://localhost:3000/journal. If the Vercel storage isn't connected locally, everything saves to a `.journal-data` folder in the project. Git ignores that folder, and no password is needed. To work with your real journal locally, run `vercel env pull .env.local` first.

## Renaming it

Edit `lib/journal/config.ts` to change "Senior Project Documentation" and the subtitle.
