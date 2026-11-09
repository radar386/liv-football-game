# LIV Football Quick Match

A browser-playable football mini-game. It runs entirely in the browser and does
not require a server or third-party assets.

## Play

Open `index.html` in a modern browser, or serve this folder with any static web
server. Select **Kick off** to start a 90-second match.

- Control the highlighted player with **WASD** or the **arrow keys**.
- Pass with **E**, shoot with **Space**, switch to the nearest teammate with
  **Q** (or **Tab**), tackle with **F**, and sprint with **Shift**.
- Teammates and opponents move with AI; win possession, pass into space, and
  attack the opposing goal.
- On a phone or tablet, use the on-screen direction pad, **SWITCH**, **PASS**,
  **TACKLE**, and **SHOOT** buttons.
- Use **Pause**, **Resume**, or **Restart** at any time.

## Publish with GitHub Pages

The repository workflow at `.github/workflows/pages.yml` publishes this folder
when changes are pushed to `main` or `master`.

1. Create a GitHub repository containing the files from this `football-game`
   folder (`index.html`, `script.js`, `style.css`, and `.github/workflows/`).
   Keep the Unity client and Python backend out of this public static-game
   repository.
2. In the repository, open **Settings → Pages** and select **GitHub Actions**
   as the build and deployment source.
3. Push to `main` or `master`, or run **Deploy football game to GitHub Pages**
   from the **Actions** tab.
4. Open the Pages URL shown in the deployment workflow. For a project repository
   it is usually `https://OWNER.github.io/REPOSITORY/`.

GitHub Pages hosts only this static browser game. The existing Python online
API and Unity scripts are not included in this web build; the API needs a
separate HTTPS-capable host.
