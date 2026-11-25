# Running /hunter on your own computer

This repo carries the `/hunter` skill and the career-site reader. Your personal files (resume, profile, packets) are kept out of git, so you bring them over from the download `hunter-data.zip`.

## 1. What you need
- **Claude Code**, either in the Claude desktop app or the terminal (`claude`).
- **Node.js 18 or newer** (check with `node -v`). On a Mac: `brew install node`.
- **Git.**
- **Google Chrome** with the **Claude in Chrome** extension, if you want Claude to fill forms for you (step 5).

## 2. Get the repo
```bash
git clone https://github.com/samarthm04/JobHuntNApply.git
cd JobHuntNApply
git checkout claude/happy-bell-8t7h3m   # until this branch is merged into main
```

## 3. Put your files back
Unzip `hunter-data.zip` inside the `JobHuntNApply` folder, so you get `JobHuntNApply/.hunter/RESUME.md`, `PROFILE.md`, `jobs/` and the rest.
```bash
unzip ~/Downloads/hunter-data.zip -d .
ls .hunter        # should list PROFILE.md, RESUME.md, RESUME-PM.md, SOURCES.md, jobs, ...
```
Git ignores everything in `.hunter/` except `tools/`, so these files stay on your computer only.

## 4. Set up the career-site reader (one time)
It reads Amazon, Microsoft, Google, Apple, BCG, Bain, Deloitte, EY and PwC.
```bash
cd .hunter/tools
npm init -y
npm install playwright
npx playwright install chromium
node careers.js amazon | head -c 300   # quick test: should print JSON with "jobs"
cd ../..
```

## 5. Check /hunter works
Start Claude Code in the `JobHuntNApply` folder (open the folder in the desktop app, or run `claude` there), then type:
```
/hunter log
```
You should see your Amazon and GitLab rows. After that, the usual commands work:
- `/hunter run`: find new jobs, score them, and prepare packets for the ones scoring 80 or more
- `/hunter job <link>`: score one posting you pick (use it for Meta, McKinsey, or any site the reader can't reach)
- `/hunter review`: walk through the jobs you said yes to, opening each page for you
- `/hunter applied <number or all>` and `/hunter log`

## 6. Let Claude fill forms in Chrome
1. Install the Claude in Chrome extension and connect it to the Claude desktop app (the extension walks you through it).
2. Log in to the job site yourself (create the amazon.jobs account yourself; Claude never enters passwords).
3. Open the application page and ask, for example:
   > Fill this application from `.hunter/jobs/2026-11-25-gitlab-applied-ai-engineer/PACKET.md`. Attach RESUME.pdf and COVER-LETTER.pdf from the same folder. Stop before submitting.
4. Check every field, especially dropdowns and written answers, then press **Submit** yourself.
5. Tell Claude `/hunter applied <number>` so the log stays current.

## 7. Daily search (optional)
- While a Claude Code session is open: `/loop 24h /hunter morning`
- Without keeping a session open: in the Claude desktop app, add a scheduled task that runs `/hunter morning` in this folder each morning. A cloud task can't see your `.hunter/` files, so it has to run on your computer.

It runs only while your computer is awake and Claude is running, and each run uses your Claude plan's usage.

## Good to know
- Back up `.hunter/` now and then (it is not in git). A private cloud folder works.
- Your profile already holds your form answers (notice period, CTC, relocation and so on), so new packets fill these in.
- `/hunter` never submits, never creates accounts and never gets past a CAPTCHA. Every send is your click.
