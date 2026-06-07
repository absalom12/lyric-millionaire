export const appFontClass =
  "font-[Inter,ui-sans-serif,system-ui,sans-serif]";

export const displayFontClass =
  "font-[Montserrat,Inter,ui-sans-serif,system-ui,sans-serif]";

let fontsInjected = false;

export function ensureAppFonts() {
  if (typeof document === "undefined" || fontsInjected) return;

  const existing = document.querySelector('link[data-lyric-fonts="true"]');

  if (existing) {
    fontsInjected = true;
    return;
  }

  const preconnectGoogle = document.createElement("link");
  preconnectGoogle.rel = "preconnect";
  preconnectGoogle.href = "https://fonts.googleapis.com";
  preconnectGoogle.dataset.lyricFonts = "true";

  const preconnectStatic = document.createElement("link");
  preconnectStatic.rel = "preconnect";
  preconnectStatic.href = "https://fonts.gstatic.com";
  preconnectStatic.crossOrigin = "anonymous";
  preconnectStatic.dataset.lyricFonts = "true";

  const fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&family=Montserrat:wght@800;900&display=swap";
  fontLink.dataset.lyricFonts = "true";

  document.head.append(preconnectGoogle, preconnectStatic, fontLink);

  fontsInjected = true;
}