const DEFAULT_STATE = {
  blockedSites: [],
  blockedSearches: [],
};

const siteInput = document.getElementById("site-input");
const searchInput = document.getElementById("search-input");
const addSiteButton = document.getElementById("add-site");
const addSearchButton = document.getElementById("add-search");
const siteList = document.getElementById("site-list");
const searchList = document.getElementById("search-list");

function normalizeEntry(value) {
  return value.trim().toLowerCase();
}

function renderList(listElement, items, onRemove) {
  listElement.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "list-item";
    const span = document.createElement("span");
    span.textContent = item;
    const button = document.createElement("button");
    button.textContent = "Remove";
    button.className = "remove";
    button.addEventListener("click", () => onRemove(item));
    li.append(span, button);
    listElement.appendChild(li);
  });
}

function loadState() {
  chrome.storage.sync.get(DEFAULT_STATE, (data) => {
    renderList(siteList, data.blockedSites || [], removeSite);
    renderList(searchList, data.blockedSearches || [], removeSearch);
  });
}

function updateStorage(key, items) {
  const payload = {};
  payload[key] = items;
  chrome.storage.sync.set(payload, loadState);
}

function addSite() {
  const entry = normalizeEntry(siteInput.value);
  if (!entry) return;
  chrome.storage.sync.get(DEFAULT_STATE, (data) => {
    const next = Array.from(new Set([...(data.blockedSites || []), entry]));
    updateStorage("blockedSites", next);
    siteInput.value = "";
  });
}

function addSearch() {
  const entry = normalizeEntry(searchInput.value);
  if (!entry) return;
  chrome.storage.sync.get(DEFAULT_STATE, (data) => {
    const next = Array.from(new Set([...(data.blockedSearches || []), entry]));
    updateStorage("blockedSearches", next);
    searchInput.value = "";
  });
}

function removeSite(entry) {
  chrome.storage.sync.get(DEFAULT_STATE, (data) => {
    const next = (data.blockedSites || []).filter((item) => item !== entry);
    updateStorage("blockedSites", next);
  });
}

function removeSearch(entry) {
  chrome.storage.sync.get(DEFAULT_STATE, (data) => {
    const next = (data.blockedSearches || []).filter((item) => item !== entry);
    updateStorage("blockedSearches", next);
  });
}

addSiteButton.addEventListener("click", addSite);
addSearchButton.addEventListener("click", addSearch);

siteInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addSite();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addSearch();
});

document.addEventListener("DOMContentLoaded", loadState);
loadState();
