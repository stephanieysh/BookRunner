const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

// Change this when moving from localhost to staging and production
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const TEST_EMAIL = process.env.E2E_EMAIL || 'test@gmail.com';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'tester123';
const DEFAULT_TIMEOUT = 10000;

jest.setTimeout(60000);

// Custom browser driver
function createDriver() {
  const options = new chrome.Options();

  options.addArguments(
    '--headless=new',
    '--window-size=1920,1080',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-notifications',
    '--disable-popup-blocking',
    '--disable-infobars',
    '--disable-save-password-bubble',
    '--disable-features=PasswordManagerOnboarding,PasswordCheck,PasswordLeakDetection'
  );

  options.setUserPreferences({
    'credentials_enable_service': false,
    'profile.password_manager_enabled': false,
    'profile.password_manager_leak_detection': false,
    'profile.password_manager_leak_detection_enabled': false,
    'autofill.profile_enabled': false,
    'autofill.credit_card_enabled': false
  });

  return new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();
}

// Helper function
async function waitVisible(driver, locator, timeout = DEFAULT_TIMEOUT) {
  const element = await driver.wait(until.elementLocated(locator), timeout);
  return element;
}

async function waitClickable(driver, locator, timeout = DEFAULT_TIMEOUT) {
  const element = await waitVisible(driver, locator, timeout);
  return element;
}

// Login helper function
async function login(driver) {
  await driver.get(`${BASE_URL}/#/login`);

  const emailInput = await waitVisible(driver, By.css('input[name="email"]'));
  await emailInput.clear();
  await emailInput.sendKeys(TEST_EMAIL);

  const passwordInput = await waitVisible(driver, By.css('input[name="password"]'));
  await passwordInput.clear();
  await passwordInput.sendKeys(TEST_PASSWORD);

  const loginButton = await waitClickable(driver, By.css('button[name="login-btn"]'));
  await loginButton.click();

  try {
    await driver.wait(until.urlContains('/product'), DEFAULT_TIMEOUT);
  } catch (error) {
    const currentUrl = await driver.getCurrentUrl();
    const pageText = await driver.findElement(By.css('body')).getText();

    console.log('Login failed in Selenium test.');
    console.log('Current URL:', currentUrl);
    console.log('Page text:', pageText);
    console.log('TEST_EMAIL:', TEST_EMAIL);
    console.log('Password length:', TEST_PASSWORD.length);

    throw error;
  }
}

// Search helper function
async function searchProduct(driver, keyword) {
  const searchInput = await driver.wait(async () => {
    const inputs = await driver.findElements(
      By.css('input[placeholder="Title, Author or Keywords..."]')
    );

    for (const input of inputs) {
      if (await input.isDisplayed()) {
        return input;
      }
    }

    return false;
  }, DEFAULT_TIMEOUT);

  await searchInput.clear();
  await searchInput.sendKeys(keyword);
}

// Click on product helper function
async function openProduct(driver, productName) {
  const productLink = await driver.wait(async () => {
    try {
      const links = await driver.findElements(By.css('a[href*="/book/"]'));

      for (const link of links) {
        try {
          const isDisplayed = await link.isDisplayed();

          if (!isDisplayed) {
            continue;
          }

          const text = await link.getText();

          if (text.includes(productName)) {
            return link;
          }
        } catch (error) {
          // Vue may re-render the product card, causing stale element.
          // Ignore this link and retry in the next wait cycle.
          continue;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }, DEFAULT_TIMEOUT);

  await driver.executeScript(
    "arguments[0].scrollIntoView({block: 'center'});",
    productLink
  );

  await driver.wait(until.elementIsVisible(productLink), DEFAULT_TIMEOUT);
  await driver.wait(until.elementIsEnabled(productLink), DEFAULT_TIMEOUT);

  await driver.executeScript("arguments[0].click();", productLink);

  await driver.wait(until.urlContains('/book/'), DEFAULT_TIMEOUT);
}

// Add to cart helper function
async function addCurrentBookToCart(driver) {
  const addToCartButton = await waitClickable(
    driver,
    By.css('button[name="cart-btn"]')
  );

  await addToCartButton.click();
}

let driver;

beforeEach(async () => {
  driver = await createDriver();

  await driver.manage().setTimeouts({
    implicit: 0,
    pageLoad: 30000,
    script: 30000
  });

  await driver.manage().window().setRect({
    width: 1920,
    height: 1080
  });
});

afterEach(async () => {
  if (driver) {
    await driver.quit();
  }
});

// Homepage loading test
test('homepage loading', async () => {
  await driver.get(BASE_URL);

  await driver.wait(until.titleContains('BOOK'), 10000);

  const appRoot = await waitVisible(driver, By.css('#app'));
  expect(await appRoot.isDisplayed()).toBe(true);
});

// Login test
test('login redirects user to product page', async () => {
  await login(driver);

  const currentUrl = await driver.getCurrentUrl();
  expect(currentUrl).toContain('/product');
});

// Search product test
test('search product displays One Piece result', async () => {
  await driver.get(`${BASE_URL}/#/product`);

  await waitVisible(
    driver,
    By.xpath("//*[contains(text(), 'Explore Our Manga')]")
  );

  await searchProduct(driver, 'One Piece');

  const resultTitle = await waitVisible(
    driver,
    By.xpath("//*[contains(text(), 'One Piece')]")
  );

  expect(await resultTitle.isDisplayed()).toBe(true);
});

// Add to cart test
test('add a book to cart after login', async () => {
  await login(driver);
  await searchProduct(driver, 'One Piece');
  await openProduct(driver, 'One Piece');
  await addCurrentBookToCart(driver);

  const successMessage = await waitVisible(
    driver,
    By.xpath("//*[contains(text(), 'Successfully added to cart')]")
  );

  expect(await successMessage.isDisplayed()).toBe(true);
});

// Cart to purchase test
test('create purchase from cart after adding a book', async () => {
  // 1. Login
  await login(driver);

  // 2. Search for a known product
  await searchProduct(driver, 'One Piece');

  // 3. Open the product detail page
  await openProduct(driver, 'One Piece');

  // 4. Add book to cart
  await addCurrentBookToCart(driver);

  // 5. Verify add to cart success message
  const successMessage = await waitVisible(
    driver,
    By.xpath("//*[contains(text(), 'Successfully added to cart')]")
  );

  expect(await successMessage.isDisplayed()).toBe(true);

  // 6. Navigate to cart page
  await driver.get(`${BASE_URL}/#/cart`);

  await waitVisible(
    driver,
    By.xpath("//*[contains(text(), 'My Cart')]")
  );

  // 7. Verify cart contains selected book
  await waitVisible(
    driver,
    By.xpath("//*[contains(text(), 'One Piece')]")
  );

  // 8. Select all cart items
  const selectAllCheckbox = await waitClickable(
    driver,
    By.css('#selectAll')
  );

  await selectAllCheckbox.click();

  // 9. Checkout
  const checkoutButton = await waitClickable(
    driver,
    By.xpath("//button[contains(., 'Checkout')]")
  );

  await checkoutButton.click();

  // 10. Verify cart becomes empty after checkout
  const emptyCartMessage = await waitVisible(
    driver,
    By.xpath("//*[contains(text(), 'Your cart is empty') or contains(text(), 'Add some books to get started')]")
  );

  expect(await emptyCartMessage.isDisplayed()).toBe(true);

  // 11. Navigate to purchase page
  await driver.get(`${BASE_URL}/#/purchase`);

  await driver.wait(until.urlContains('/purchase'), DEFAULT_TIMEOUT);

  // 12. Verify purchase page is loaded
  await waitVisible(
    driver,
    By.xpath("//*[contains(text(), 'Purchase') or contains(text(), 'Purchase History') or contains(text(), 'My Purchase')]")
  );

  // 13. Verify purchased book appears in purchase history
  const purchasedBook = await waitVisible(
    driver,
    By.xpath("//*[contains(text(), 'One Piece')]")
  );

  expect(await purchasedBook.isDisplayed()).toBe(true);
}, 60000);

// Reset password test
test('user can reset password from profile page', async () => {
  // 1. Login first
  await login(driver);

  // 2. Navigate to profile page
  await driver.get(`${BASE_URL}/#/profile`);
  await driver.wait(until.urlContains('/profile'), DEFAULT_TIMEOUT);

  // 3. Click Reset Password button on profile page
  const resetPasswordButton = await waitClickable(
    driver,
    By.xpath("//button[contains(., 'Reset Password')]")
  );

  await resetPasswordButton.click();

  // 4. Verify password reset page/form is loaded
  await waitVisible(
    driver,
    By.xpath("//*[contains(text(), 'Password Reset')]")
  );

  // 5. Enter new password
  const newPasswordInput = await waitVisible(
    driver,
    By.css('input[name="password"]')
  );

  await newPasswordInput.clear();
  await newPasswordInput.sendKeys('tester123');

  // 6. Enter confirm new password
  const confirmPasswordInput = await waitVisible(
    driver,
    By.css('input[name="confirmPassword"]')
  );

  await confirmPasswordInput.clear();
  await confirmPasswordInput.sendKeys('tester123');

  // 7. Click Reset Password submit button
  const submitResetButton = await waitClickable(
    driver,
    By.xpath("//button[contains(., 'Reset Password')]")
  );

  await submitResetButton.click();

  // 8. Verify success message appears
  const successMessage = await waitVisible(
    driver,
    By.xpath("//*[contains(text(), 'Your password has been reset successfully.')]")
  );

  expect(await successMessage.isDisplayed()).toBe(true);
}, 60000);

// Log out test
test('user can log out after login', async () => {
  // 1. Login first
  await login(driver);

  // 2. Navigate to profile page where the Log Out button exists
  await driver.get(`${BASE_URL}/#/profile`);

  await driver.wait(until.urlContains('/profile'), DEFAULT_TIMEOUT);

  // 3. Wait for Log Out button
  const logoutButton = await waitClickable(
    driver,
    By.xpath("//button[contains(., 'Log Out')]")
  );

  // 4. Click Log Out
  await logoutButton.click();

  // 5. Verify user is redirected to homepage
  await driver.wait(until.urlIs(`${BASE_URL}/#/`), DEFAULT_TIMEOUT);

  const currentUrl = await driver.getCurrentUrl();
  expect(currentUrl).toBe(`${BASE_URL}/#/`);
}, 60000);
