const DEFAULT_URLS = [
  { url: "https://github.com/transfon/teamtalk.com-wp/pulls?q=is%3Apr+is%3Aclosed", title: "TT" },
  { url: "https://github.com/transfon/football365.com-wp/pulls?q=is%3Apr+is%3Aclosed", title: "F365" },
  { url: "https://github.com/transfon/planetfootball.com-wp/pulls?q=is%3Apr+is%3Aclosed", title: "PF" },
  { url: "https://github.com/transfon/planetf1-wp/pulls?q=is%3Apr+is%3Aclosed", title: "PF1" },
  { url: "https://github.com/transfon/planetrugby.com-wp/pulls?q=is%3Apr+is%3Aclosed", title: "PR" },
  { url: "https://github.com/transfon/loverugbyleague-wp/pulls?q=is%3Apr+is%3Aclosed", title: "LRL" },
  { url: "https://github.com/transfon/golf365.com-wp/pulls?q=is%3Apr+is%3Aclosed", title: "G365" },
  { url: "https://github.com/transfon/tennis365.com-wp/pulls?q=is%3Apr+is%3Aclosed", title: "T365" },
  { url: "https://github.com/transfon/cricket365.com-wp/pulls?q=is%3Apr+is%3Aclosed", title: "C365" },
  { url: "https://github.com/transfon/stuff365.com-wp/pulls?q=is%3Apr+is%3Aclosed", title: "S365" }
];

document.addEventListener('DOMContentLoaded', function() {
  const urlInput = document.getElementById('url');
  const titleInput = document.getElementById('title');
  const addUrlButton = document.getElementById('addUrl');
  const urlList = document.getElementById('urlList');
  const fetchButton = document.getElementById('fetch');
  const clearButton = document.getElementById('clear');
  const copyButton = document.getElementById('copy');
  const resultDiv = document.getElementById('result');
  const includeCommitsCheckbox = document.getElementById('includeCommits');

  chrome.storage.local.get(['urls', 'lastResult', 'includeCommits'], function(result) {
    let urlsToUse = result.urls;
    if (!urlsToUse || urlsToUse.length === 0) {
      urlsToUse = DEFAULT_URLS;
      chrome.storage.local.set({ urls: DEFAULT_URLS });
    }
    urlsToUse.forEach(url => addUrlToList(url.url, url.title));
    if (result.lastResult) {
      resultDiv.textContent = result.lastResult;
      copyButton.disabled = false;
    }
    if (result.includeCommits !== undefined) {
      includeCommitsCheckbox.checked = result.includeCommits;
    }
  });

  includeCommitsCheckbox.addEventListener('change', function() {
    chrome.storage.local.set({ includeCommits: this.checked });
  });

  addUrlButton.addEventListener('click', function() {
    const url = urlInput.value.trim();
    const title = titleInput.value.trim();
    
    if (url && title) {
      addUrlToList(url, title);
      saveUrls();
      urlInput.value = '';
      titleInput.value = '';
    }
  });

  function getWeekRange() {
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { monday, sunday };
  }

  function isWithinThisWeek(datetimeStr) {
    const { monday, sunday } = getWeekRange();
    const prDate = new Date(datetimeStr);
    if (isNaN(prDate.getTime())) return false;
    return prDate >= monday && prDate <= sunday;
  }

  async function getCommitMessages(prUrl) {
    try {
      // 拼接 commit 列表页 URL
      let commitsUrl = prUrl;
      if (!commitsUrl.endsWith('/commits')) {
        if (commitsUrl.endsWith('/')) {
          commitsUrl += 'commits';
        } else {
          commitsUrl += '/commits';
        }
      }
      console.log('Fetching commits from:', commitsUrl);
      const response = await fetch(commitsUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');

      // 先获取所有ul
      const ulList = doc.querySelectorAll('ul[data-listview-component="items-list"]');
      console.log('ulList', ulList);
      let commits = [];
      ulList.forEach(ul => {
        const liList = ul.querySelectorAll('li');
        liList.forEach(li => {
          const a = li.querySelector('h4 a');
          if (a && a.textContent.trim()) {
            commits.push(a.textContent.trim());
          }
        });
      });
      console.log('Found commits:', commits);
      return commits;
    } catch (error) {
      console.error(`Error fetching commits from ${prUrl}: ${error.message}`);
      return [];
    }
  }

  fetchButton.addEventListener('click', async function() {
    // 显示loading状态并禁用按钮
    const originalFetchText = fetchButton.textContent;
    const originalClearText = clearButton.textContent;
    
    fetchButton.textContent = 'Loading...';
    fetchButton.disabled = true;
    clearButton.disabled = true;
    copyButton.disabled = true;
    
    // 清空result内容
    resultDiv.textContent = '';
    
    try {
      const urls = await getUrls();
      const includeCommits = includeCommitsCheckbox.checked;
      let result = '';

      for (let urlIdx = 0; urlIdx < urls.length; urlIdx++) {
        const url = urls[urlIdx];
        
        // Update loading text to show progress
        fetchButton.textContent = `Loading... (${urlIdx + 1}/${urls.length})`;
        
        try {
          const response = await fetch(url.url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const text = await response.text();
          if (!text.trim()) {
            throw new Error('No content');
          }
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          
          const prElements = doc.querySelectorAll('.js-issue-row');
          const prData = Array.from(prElements)
            .map(el => {
              const titleEl = el.querySelector('.js-navigation-open');
              const timeEl = el.querySelector('relative-time');
              if (!titleEl || !timeEl) return null;
              const title = titleEl.textContent.trim();
              const datetime = timeEl.getAttribute('datetime');
              let prUrl = titleEl.getAttribute('href');
              if (prUrl.startsWith('/')) {
                prUrl = 'https://github.com' + prUrl;
              }
              return { title, datetime, prUrl };
            })
            .filter(item => item && isWithinThisWeek(item.datetime));

          // 只有当有PR结果时才显示该项目
          if (prData.length > 0) {
            if (urlIdx !== 0 && result !== '') {
              result += '\n'; // 除第一个项目标题外，前面多加一个换行
            }
            result += `${url.title}:\n\n`;
            
            for (let i = 0; i < prData.length; i++) {
              const pr = prData[i];
              const cleanTitle = pr.title.replace(/\.$/, '');
              
              if (includeCommits && pr.prUrl) {
                // Fetch commit messages for this PR
                const commits = await getCommitMessages(pr.prUrl);
                console.log('PR:', pr.prUrl, 'Commits:', commits);
                if (commits.length > 0) {
                  result += `${cleanTitle}\n`;
                  commits.forEach(commit => {
                    result += `  - ${commit}\n`;
                  });
                } else {
                  result += cleanTitle;
                }
              } else {
                result += cleanTitle;
              }
              
              // Add newline between PRs
              if (i < prData.length - 1) {
                result += '\n';
              }
            }
            
            // 只在不是最后一个项目标题时添加换行
            if (urlIdx < urls.length - 1) {
              result += '\n\n';
            }
          }
        } catch (error) {
          // 错误情况下也跳过该项目，不显示
          console.error(`Error fetching ${url.title}: ${error.message}`);
        }
      }

      resultDiv.textContent = result;
      
      // 如果有结果内容，启用copy按钮并保存结果
      if (result.trim()) {
        copyButton.disabled = false;
        // 保存最近一次的结果
        chrome.storage.local.set({ lastResult: result });
      } else {
        resultDiv.textContent = 'No PRs found within this week.';
      }
    } catch (error) {
      resultDiv.textContent = `Error: ${error.message}`;
    } finally {
      // 恢复按钮状态
      fetchButton.textContent = originalFetchText;
      fetchButton.disabled = false;
      clearButton.disabled = false;
      copyButton.disabled = false;
    }
  });

  clearButton.addEventListener('click', function() {
    resultDiv.textContent = '';
    copyButton.disabled = true;
    chrome.storage.local.remove(['lastResult']);
  });

  copyButton.addEventListener('click', async function() {
    const textToCopy = resultDiv.textContent;
    if (textToCopy.trim()) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = copyButton.textContent;
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = originalText;
        }, 1000);
      } catch (error) {
        console.error('Failed to copy text: ', error);
        // 降级方案：使用传统的复制方法
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        const originalText = copyButton.textContent;
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = originalText;
        }, 1000);
      }
    }
  });

  function addUrlToList(url, title) {
    const div = document.createElement('div');
    div.className = 'url-item';
    
    const urlSpan = document.createElement('span');
    urlSpan.textContent = url;
    urlSpan.style.marginRight = '10px';
    
    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    titleSpan.style.marginRight = '10px';
    
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', function() {
      div.remove();
      saveUrls();
    });

    div.appendChild(urlSpan);
    div.appendChild(titleSpan);
    div.appendChild(deleteButton);
    urlList.appendChild(div);
  }

  function saveUrls() {
    const urls = [];
    const urlItems = urlList.getElementsByClassName('url-item');
    
    for (const item of urlItems) {
      const spans = item.getElementsByTagName('span');
      urls.push({
        url: spans[0].textContent,
        title: spans[1].textContent
      });
    }

    chrome.storage.local.set({ urls: urls });
  }

  function getUrls() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['urls'], function(result) {
        resolve(result.urls || []);
      });
    });
  }
}); 