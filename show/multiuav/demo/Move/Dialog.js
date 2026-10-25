let textDialogTimer = null;

export function DialogLoadingOpen(text) {
  const dialogLoading = document.getElementById("dialog-loading");
  const dialogText = document.getElementById("dialog-loading-text");
  if (!dialogLoading || !dialogText) return;
  dialogText.textContent = text;
  dialogLoading.style.display = "block";
}

export function DialogLoadingClose() {
  const dialogLoading = document.getElementById("dialog-loading");
  const dialogText = document.getElementById("dialog-loading-text");
  if (!dialogLoading || !dialogText) return;
  dialogLoading.style.display = "none";
  dialogText.textContent = "";
}

export function DialogText(text, duration = 1000) {
  const dialogText = document.getElementById("dialog-text");
  const dialogTextContent = document.getElementById("dialog-text-content");
  if (!dialogText || !dialogTextContent) return;

  if (textDialogTimer) clearTimeout(textDialogTimer);
  dialogTextContent.textContent = text;
  dialogText.style.display = "block";
  textDialogTimer = setTimeout(() => {
    dialogTextContent.textContent = "";
    dialogText.style.display = "none";
    textDialogTimer = null;
  }, duration);
}
