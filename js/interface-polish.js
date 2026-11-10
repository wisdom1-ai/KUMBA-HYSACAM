/* Small interface-wide text and OTP refinements */
(() => {
  const clean = node => {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const parent = node.parentElement;
    if (!parent || /^(SCRIPT|STYLE|TEXTAREA|INPUT|CODE|PRE)$/i.test(parent.tagName)) return;
    node.nodeValue = node.nodeValue.replace(/\.(?=\s|$)/g, '');
  };
  const walk = root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(clean);
  };
  walk(document.body);
  new MutationObserver(records => records.forEach(record => {
    if (record.type === 'characterData') clean(record.target);
    record.addedNodes && record.addedNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) clean(node);
      else if (node.nodeType === Node.ELEMENT_NODE) walk(node);
    });
  })).observe(document.body, {subtree:true,childList:true,characterData:true});

  const adminCode = document.getElementById('admin-code');
  const adminVerify = document.getElementById('admin-verify');
  if (adminCode && adminVerify) {
    let last = '';
    const submit = () => {
      const code = adminCode.value.replace(/\D/g, '').slice(0, 6);
      adminCode.value = code;
      if (code.length === 6 && code !== last) { last = code; adminVerify.click(); }
      if (code.length < 6) last = '';
    };
    adminCode.addEventListener('input', submit);
    adminCode.addEventListener('paste', () => setTimeout(submit, 0));
  }
})();
