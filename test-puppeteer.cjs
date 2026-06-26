const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3002', { waitUntil: 'domcontentloaded' });
    console.log('Page loaded');
    
    // Login as admin
    const loginButton = await page.waitForSelector('button::-p-text(Admin/Editor Login)', { timeout: 5000 }).catch(() => null);
    if (loginButton) {
      await loginButton.click();
      await page.waitForSelector('input[type="password"]', { timeout: 2000 });
      await page.type('input[type="password"]', 'extra2026');
      const accessBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(b => b.textContent.includes('Access Secure Area'));
      });
      await accessBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // Check if books exist, if not, create one!
    const tabs = await page.$$('button');
    for (let tab of tabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text && text.includes('Textbook Volumes')) {
        await tab.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1000));
    
    let books = await page.$$('[id^="admin-book-item-"]');
    if (books.length === 0) {
      console.log('Creating a book...');
      // Type title
      const inputs = await page.$$('input[type="text"]');
      if (inputs.length > 0) {
        await inputs[0].type('Test Book');
      }
      // Click create
      const createBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(b => b.textContent.includes('Create Empty Textbook'));
      });
      if (createBtn) await createBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }
    
    books = await page.$$('[id^="admin-book-item-"]');
    if (books.length > 0) {
      console.log('Clicking the book!');
      await books[0].click();
      await new Promise(r => setTimeout(r, 2000));
      console.log('Click succeeded without crash!');
    } else {
      console.log('Still no books...');
    }
  } catch(e) {
    console.error('TEST ERROR:', e);
  } finally {
    await browser.close();
  }
  page.on('pageerror', err => {
    console.error('PAGE ERROR:', err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('CONSOLE ERROR:', msg.text());
    }
  });

  try {
    await page.goto('http://localhost:3002', { waitUntil: 'domcontentloaded' });
    console.log('Page loaded');
    
    // Login as admin
    const loginButton = await page.waitForSelector('button::-p-text(Admin/Editor Login)', { timeout: 5000 }).catch(() => null);
    if (loginButton) {
      await loginButton.click();
      await page.waitForSelector('input[type="password"]', { timeout: 2000 });
      await page.type('input[type="password"]', 'extra2026');
      
      const accessBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(b => b.textContent.includes('Access Secure Area'));
      });
      await accessBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log('Logged in, waiting for Admin Panel');
    // Click Textbook Volumes tab
    const tabs = await page.$$('button');
    for (let tab of tabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text && text.includes('Textbook Volumes')) {
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('Clicking a book');
    // Click a book
    await page.waitForSelector('[id^="admin-book-item-"]', { timeout: 10000 }).catch(() => null);
    const books = await page.$$('[id^="admin-book-item-"]');
    if (books.length > 0) {
      await books[0].click();
      await new Promise(r => setTimeout(r, 2000));
      console.log('Book clicked successfully without crash!');
    } else {
      console.log('No books found');
    }
    
  } catch(e) {
    console.error('TEST SCRIPT ERROR:', e);
  } finally {
    await browser.close();
  }
})();
