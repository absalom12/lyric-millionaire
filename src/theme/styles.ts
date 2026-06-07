export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function getPageBg(isLight: boolean) {
  return isLight
    ? "bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-100 text-slate-950"
    : "bg-[#050509] text-white";
}

export function getMutedText(isLight: boolean) {
  return isLight ? "text-slate-600" : "text-gray-400";
}

export function getCardStyle(isLight: boolean) {
  return isLight
    ? "border-orange-200 bg-white/85 text-slate-950 shadow-orange-100/80"
    : "border-white/10 bg-gray-950/70 text-white shadow-black/30";
}

export function getSoftCardStyle(isLight: boolean) {
  return isLight
    ? "border-orange-100 bg-white/70 text-slate-950 shadow-orange-100/70"
    : "border-white/10 bg-white/[0.04] text-white shadow-black/20";
}

export function getPrimaryButtonStyle(isLight: boolean) {
  return isLight
    ? "border-orange-500 bg-orange-500 text-black shadow-orange-300/50 hover:bg-orange-400"
    : "border-yellow-400 bg-yellow-400 text-black shadow-yellow-400/30 hover:bg-yellow-300";
}

export function getSecondaryButtonStyle(isLight: boolean) {
  return isLight
    ? "border-orange-200 bg-white/85 text-orange-700 shadow-orange-100/60 hover:bg-orange-50"
    : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]";
}

export function getAccentText(isLight: boolean) {
  return isLight ? "text-orange-700" : "text-yellow-400";
}

export function getMoneyText(isLight: boolean) {
  return isLight ? "text-emerald-600" : "text-green-300";
}

export function getRingGlow(isLight: boolean) {
  return isLight ? "shadow-orange-100/80" : "shadow-yellow-400/10";
}
