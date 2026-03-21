# GitHub / NAS Deployment

This project can be deployed to your NAS directly from a Git repository.

## 1. Push this project to GitHub

After you create an empty GitHub repository, run these commands locally:

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

Examples:

```bash
git remote add origin git@github.com:your-name/neon-pulse-nav.git
git push -u origin main
```

or

```bash
git remote add origin https://github.com/your-name/neon-pulse-nav.git
git push -u origin main
```

## 2. First deployment on NAS

Clone the repo on your NAS:

```bash
git clone <your-github-repo-url>
cd neon-pulse-nav
cp .env.example .env
```

Edit `.env` if needed, then run:

```bash
sudo sh scripts/nas-git-deploy.sh
```

## 3. Update on NAS

Go into the cloned repo and run:

```bash
cd /path/to/neon-pulse-nav
sudo sh scripts/nas-git-update.sh
```

This will:

- `git pull --ff-only`
- rebuild the Docker image on the NAS
- restart the container with the latest source

## 4. Data persistence

These folders should be kept when you update:

- `data/`
- `nas/transfer/`
- `nas/music/`
- `.env`

The workspace state, login credentials, upload index, and music library metadata are kept outside the image through Docker volumes.
