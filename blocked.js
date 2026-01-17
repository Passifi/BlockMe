const message = document.getElementById("message");
const target = document.getElementById("target");

const params = new URLSearchParams(window.location.search);
const type = params.get("type");
const targetUrl = params.get("target");

if (type === "search") {
  message.textContent =
    "This search matches a blocked request. Try something more focused.";
} else {
  message.textContent =
    "This site is on your blocked list. Stay on track.";
}

if (targetUrl) {
  try {
    const decoded = decodeURIComponent(targetUrl);
    target.textContent = decoded;
  } catch {
    target.textContent = targetUrl;
  }
}
