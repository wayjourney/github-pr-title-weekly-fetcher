document.addEventListener('DOMContentLoaded', function() {
  const urlInput = document.getElementById('url');
  const titleInput = document.getElementById('title');
  const addUrlButton = document.getElementById('addUrl');
  const urlList = document.getElementById('urlList');
  const fetchButton = document.getElementById('fetch');
  const clearButton = document.getElementById('clear');
  const copyButton = document.getElementById('copy');
  const resultDiv = document.getElementById('result');

  chrome.storage.local.get(['urls', 'lastResult'], function(result) {
    if (result.urls) {
      result.urls.forEach(url => addUrlToList(url.url, url.title));
    }
    if (result.lastResult) {
      resultDiv.textContent = result.lastResult;
      copyButton.disabled = false;
    }
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
      let result = '';

      for (let urlIdx = 0; urlIdx < urls.length; urlIdx++) {
        const url = urls[urlIdx];
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
          const prTitles = Array.from(prElements)
            .map(el => {
              const titleEl = el.querySelector('.js-navigation-open');
              const timeEl = el.querySelector('relative-time');
              if (!titleEl || !timeEl) return null;
              const title = titleEl.textContent.trim();
              const datetime = timeEl.getAttribute('datetime');
              return { title, datetime };
            })
            .filter(item => item && isWithinThisWeek(item.datetime))
            .map(item => item.title);

          // 只有当有PR结果时才显示该项目
          if (prTitles.length > 0) {
            if (urlIdx !== 0 && result !== '') {
              result += '\n'; // 除第一个项目标题外，前面多加一个换行
            }
            result += `${url.title}:\n\n`;
            prTitles.forEach((title, index) => {
              const cleanTitle = title.replace(/\.$/, '');
              if (index === prTitles.length - 1) {
                result += cleanTitle;
              } else {
                result += cleanTitle + '\n';
              }
            });
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