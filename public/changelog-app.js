const root = document.getElementById('changelogRoot');
    try {
      const res = await fetch('./changelog.json');
      if (!res.ok) throw new Error(`changelog.json returned ${res.status}`);
      const log = await res.json();
      const entries = Array.isArray(log.entries) ? log.entries : [];
      if (!entries.length) throw new Error('no entries');
      root.innerHTML = '';
      for (const entry of entries) {
        const article = document.createElement('article');
        article.className = 'cl-entry';

        const head = document.createElement('div');
        head.className = 'cl-entry-head';
        const version = document.createElement('span');
        version.className = 'cl-version';
        version.textContent = `v${entry.version}`;
        const date = document.createElement('span');
        date.className = 'cl-date';
        date.textContent = entry.date || '';
        const status = document.createElement('span');
        status.className = 'cl-status';
        status.textContent = entry.status || 'released';
        head.append(version, date, status);
        article.appendChild(head);

        for (const [name, items] of Object.entries(entry.sections || {})) {
          if (!Array.isArray(items) || !items.length) continue;
          const section = document.createElement('section');
          section.className = `cl-section ${name}`;
          const h = document.createElement('h2');
          h.textContent = name;
          section.appendChild(h);
          const ul = document.createElement('ul');
          for (const item of items) {
            const li = document.createElement('li');
            li.textContent = item;
            ul.appendChild(li);
          }
          section.appendChild(ul);
          article.appendChild(section);
        }
        root.appendChild(article);
        if (entry !== entries[entries.length - 1]) {
          const divider = document.createElement('hr');
          divider.className = 'st-divider';
          root.appendChild(divider);
        }
      }
    } catch (err) {
      root.innerHTML = '';
      const p = document.createElement('div');
      p.className = 'cl-error';
      p.textContent = `Changelog unavailable (${err.message}).`;
      root.appendChild(p);
    }
