const button = document.getElementById('demo-fullscreen');
const stage = document.getElementById('demo-stage');
if (!stage.requestFullscreen) button.hidden = true;
button.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stage.requestFullscreen();
  } catch { window.open('./demo/', '_blank', 'noopener'); }
});
