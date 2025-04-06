const giftListContainer = document.getElementById("giftList");
const showMarkedOnly = document.getElementById("showMarkedOnly");
const searchInput = document.getElementById("searchInput");
const resultCount = document.getElementById("resultCount");

let allGifts = [];

let currentSearchTerm = "";
let currentMarkedOnly = false;

window.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const savedMarkedItems = readMarkCookie();

    // Load associations
    const associations = await loadMasterFile("data/masterImageLinks.txt");

    // For each line, fetch text
    allGifts = await Promise.all(
      associations.map(async (assoc) => {
        const textContent = await fetchGiftText(`data/${assoc.fileName}`);
        const baseName = assoc.fileName.replace(/\.txt$/i, "").replace(/_/g, " ");
        return {
          fileName: assoc.fileName,
          displayName: baseName,
          imageUrl: assoc.imageUrl,
          text: textContent,
          isMarked: savedMarkedItems.includes(assoc.fileName),
          isExpanded: false
        };
      })
    );

    renderGifts(allGifts);
    updateResultCount(allGifts.length, false);

    showMarkedOnly.addEventListener("change", handleFilter);
    searchInput.addEventListener("input", handleFilter);
  } catch (err) {
    console.error("Initialization error:", err);
  }
}

async function loadMasterFile(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load master file from ${path}`);
  }
  const text = await res.text();
  const lines = text.split(/\r?\n/);

  const list = [];
  for (const line of lines) {
    if (!line.trim() || line.startsWith("#")) {
      continue;
    }
    const [fileName, imageUrl] = line.split("|");
    if (!fileName || !imageUrl) {
      console.warn("Skipping malformed line:", line);
      continue;
    }
    list.push({
      fileName: fileName.trim(),
      imageUrl: imageUrl.trim()
    });
  }
  return list;
}

async function fetchGiftText(path) {
  try {
    const resp = await fetch(path);
    if (!resp.ok) {
      console.warn("Failed to load text file:", path);
      return "(No text found)";
    }
    return await resp.text();
  } catch (err) {
    console.warn("Error fetching text file:", err);
    return "(No text found)";
  }
}

function renderGifts(gifts) {
  giftListContainer.innerHTML = "";

  gifts.forEach((gift) => {
    const container = document.createElement("div");
    container.className = "gift-container";
    if (gift.isExpanded) {
      container.classList.add("expanded");
    }

    const markCheckbox = document.createElement("input");
    markCheckbox.type = "checkbox";
    markCheckbox.className = "mark-checkbox";
    markCheckbox.checked = gift.isMarked;
    markCheckbox.addEventListener("change", () => {
      gift.isMarked = markCheckbox.checked;
      writeMarkCookie();
    });
    container.appendChild(markCheckbox);

    const img = document.createElement("img");
    img.src = gift.imageUrl;
    img.alt = gift.displayName;
    container.appendChild(img);

    const title = document.createElement("div");
    title.className = "gift-title";
    title.textContent = gift.displayName;
    container.appendChild(title);

    const details = document.createElement("div");
    details.className = "details";
    details.textContent = gift.text;
    if (gift.isExpanded) {
      details.classList.add("show");
    }
    container.appendChild(details);

    container.addEventListener("click", (evt) => {
      if (evt.target === markCheckbox) {
        return;
      }
      gift.isExpanded = !gift.isExpanded;

      // Re-render the list with the updated isExpanded value
      const filtered = applyFilter(currentSearchTerm, currentMarkedOnly);
      renderGifts(filtered);
      // Scroll into view if expanded
      if (gift.isExpanded) {
        // Delay so the newly expanded element exists in the DOM
        setTimeout(() => {
          const newIndex = filtered.findIndex(g => g.fileName === gift.fileName);
          if (newIndex !== -1) {
            // Select the newly rendered container by index
            const newContainer = giftListContainer.querySelectorAll(".gift-container")[newIndex];
            if (newContainer) {
              newContainer.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
        }, 0);
      }
    });

    giftListContainer.appendChild(container);
  });
}

function handleFilter() {
  currentSearchTerm = searchInput.value.trim().toLowerCase();
  currentMarkedOnly = showMarkedOnly.checked;

  const filtered = applyFilter(currentSearchTerm, currentMarkedOnly);
  renderGifts(filtered);
  updateResultCount(filtered.length, !!currentSearchTerm || currentMarkedOnly);
}

function applyFilter(searchTerm, markedOnly) {
  return allGifts.filter((gift) => {
    const matchesSearch =
      !searchTerm ||
      gift.displayName.toLowerCase().includes(searchTerm) ||
      gift.text.toLowerCase().includes(searchTerm);

    const matchesMark = !markedOnly || gift.isMarked;
    return matchesSearch && matchesMark;
  });
}

function updateResultCount(count, isFiltered) {
  if (isFiltered) {
    resultCount.textContent = `${count} result${count === 1 ? "" : "s"}`;
  } else {
    resultCount.textContent = `Showing all ${count} gift${count === 1 ? "" : "s"}`;
  }
}

function readMarkCookie() {
  const match = document.cookie.match(/(^|;\s*)copilotGiftMarks=([^;]+)/);
  if (!match) return [];
  try {
    const raw = decodeURIComponent(match[2]);
    const parsed = JSON.parse(raw);
    return parsed.items || [];
  } catch (e) {
    console.warn("Error parsing mark cookie:", e);
    return [];
  }
}

function writeMarkCookie() {
  const marked = allGifts
    .filter(g => g.isMarked)
    .map(g => g.fileName);

  const json = JSON.stringify({ items: marked });
  document.cookie = `copilotGiftMarks=${encodeURIComponent(json)}; max-age=31536000; path=/`;
}