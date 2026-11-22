try {
  const t = localStorage.getItem("qf-theme");
  document.documentElement.dataset.theme =
    t === "dark" ? "dark" : "light";
  document.documentElement.style.colorScheme =
    t === "dark" ? "dark" : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}
