# -*- coding: utf-8 -*-
"""Патч веб-сборки: перехват ошибок в title + запрет выделения текста."""
import io, os
p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dist3', 'index.html')
s = io.open(p, encoding='utf-8').read()
hook = '''<script>
window.addEventListener('error', function(e){ document.title = 'ERR: ' + String(e.message).slice(0,80); });
</script><style>
*, *::before, *::after { -webkit-user-select: none !important; -moz-user-select: none !important; user-select: none !important; }
input, textarea { -webkit-user-select: text !important; user-select: text !important; }
::selection { background: transparent; }
</style>'''
s = s.replace('<head>', '<head>\n' + hook, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
