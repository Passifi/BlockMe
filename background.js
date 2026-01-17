const DEFAULT_STATE = {
  blockedSites: [],
  blockedSearches: [],
};

const SEARCH_ENGINES = [
  "google.com",
  "bing.com",
  "duckduckgo.com",
  "search.yahoo.com",
  "brave.com",
  "ecosia.org",
];

let state = { ...DEFAULT_STATE };

function loadState() {
  chrome.storage.sync.get(DEFAULT_STATE, (data) => {
    state = {
      blockedSites: Array.isArray(data.blockedSites) ? data.blockedSites : [],
      blockedSearches: Array.isArray(data.blockedSearches)
        ? data.blockedSearches
        : [],
    };
  });
}

function normalizeHost(input) {
  if (!input) return "";
  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    return url.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isHostBlocked(hostname) {
  if (!hostname) return false;
  const host = hostname.toLowerCase();
  return state.blockedSites.some((entry) => {
    const blocked = normalizeHost(entry);
    if (!blocked) return false;
    return host === blocked || host.endsWith(`.${blocked}`);
  });
}

function isSearchEngine(hostname) {
  const host = hostname.toLowerCase();
  return SEARCH_ENGINES.some((engine) => host === engine || host.endsWith(engine));
}

function getSearchQuery(url) {
  const params = url.searchParams;
  return (
    params.get("q") ||
    params.get("query") ||
    params.get("p") ||
    params.get("search") ||
    ""
  );
}

function isSearchBlocked(url) {
  if (!state.blockedSearches.length) return false;
  if (!isSearchEngine(url.hostname)) return false;
  const query = getSearchQuery(url).toLowerCase();
  if (!query) return false;
  return state.blockedSearches.some((term) =>
    query.includes(String(term).toLowerCase())
  );
}

function shouldIgnoreUrl(rawUrl) {
  if (!rawUrl) return true;
  if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
    return true;
  }
  const blockedUrl = chrome.runtime.getURL("blocked.html");
  return rawUrl.startsWith(blockedUrl);
}

function maybeRedirect(tabId, rawUrl) {
  if (shouldIgnoreUrl(rawUrl)) return;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }

  let blockType = "";
  if (isHostBlocked(url.hostname)) {
    blockType = "site";
  } else if (isSearchBlocked(url)) {
    blockType = "search";
  } else {
    return;
  }

  const target = encodeURIComponent(rawUrl);
  const redirectUrl = chrome.runtime.getURL(
    `blocked.html?type=${blockType}&target=${target}`
  );
  chrome.tabs.update(tabId, { url: redirectUrl });
}

chrome.runtime.onInstalled.addListener(loadState);
chrome.runtime.onStartup.addListener(loadState);
chrome.storage.onChanged.addListener((changes) => {
  if (changes.blockedSites || changes.blockedSearches) {
    loadState();
  }
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  maybeRedirect(details.tabId, details.url);
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;
  maybeRedirect(details.tabId, details.url);
});
