/* 点击爆炸波纹特效 - 低调克制 */
(function() {
  document.addEventListener('click', function(e) {
    if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;
    if (e.target.closest('a') || e.target.closest('button')) return;

    var ripple = document.createElement('div');
    ripple.style.cssText = [
      'position:fixed',
      'left:' + (e.clientX - 15) + 'px',
      'top:' + (e.clientY - 15) + 'px',
      'width:30px;height:30px',
      'border-radius:50%',
      'border:2px solid rgba(100,100,100,0.5)',
      'pointer-events:none;z-index:9999',
      'animation:ripple-out 0.6s ease-out forwards'
    ].join(';');
    document.body.appendChild(ripple);
    setTimeout(function() { ripple.remove(); }, 650);
  });

  var style = document.createElement('style');
  style.textContent = '@keyframes ripple-out{0%{transform:scale(0);opacity:1}100%{transform:scale(2.5);opacity:0}}[data-theme="dark"] .click-ripple{border-color:rgba(200,200,200,0.4)!important}';
  document.head.appendChild(style);
})();
