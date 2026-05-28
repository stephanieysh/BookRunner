const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const crypto = require('node:crypto');

// Change this when moving from localhost to staging and production
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const DEFAULT_TIMEOUT = 10000;
const TEST_USER_API_URL = `${BASE_URL}/api/users`;

jest.setTimeout(60000);
// Custom browser driver
function createDriver() {
  const options = new chrome.Options();

  options.addArguments(
    '--window-size=1920,1080',
    '--headless=new',
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
  await driver.wait(until.elementIsVisible(element), timeout);
  return element;
}

// Login helper function
function createUniqueCredentials(label = 'user') {
  const suffix = crypto.randomUUID();
  return {
    name: `Test ${label}`,
    email: `${label}-${suffix}@example.com`,
    password: `TestPass!${suffix}`,
  };
}

async function registerUser(credentials) {
  const response = await fetch(TEST_USER_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: credentials.name,
      email: credentials.email,
      password: credentials.password,
    }),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    throw new Error(`Failed to create test user (${response.status}): ${JSON.stringify(data)}`);
  }
}

async function createAccountAndLogin(driver, label) {
  const credentials = createUniqueCredentials(label);
  await registerUser(credentials);
  await login(driver, credentials);
  return credentials;
}

async function login(driver, credentials) {
  await driver.get(`${BASE_URL}/#/login`);

  const emailInput = await waitVisible(driver, By.css('input[name="email"]'));
  await emailInput.clear();
  await emailInput.sendKeys(credentials.email);

  const passwordInput = await waitVisible(driver, By.css('input[name="password"]'));
  await passwordInput.clear();
  await passwordInput.sendKeys(credentials.password);

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
    console.log('TEST_EMAIL:', credentials.email);

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

  await driver.wait(until.titleContains('BOOK'), DEFAULT_TIMEOUT);

  const appRoot = await waitVisible(driver, By.css('#app'));
  expect(await appRoot.isDisplayed()).toBe(true);
});

// Registration test
test('user can register a new account', async () => {
  const credentials = createUniqueCredentials('register');

  // 1. Go to register page
  await driver.get(`${BASE_URL}/#/register`);

  await driver.wait(until.urlContains('/register'), DEFAULT_TIMEOUT);

  // 2. Verify register page loaded
  await waitVisible(
    driver,
    By.xpath("//*[contains(text(), 'Create Account')]")
  );

  // 3. Enter username
  const usernameInput = await waitVisible(
    driver,
    By.xpath("//label[contains(., 'Username')]/following::input[1]")
  );
  await usernameInput.clear();
  await usernameInput.sendKeys(credentials.name);

  // 4. Enter email
  const emailInput = await waitVisible(
    driver,
    By.xpath("//label[contains(., 'Email')]/following::input[1]")
  );
  await emailInput.clear();
  await emailInput.sendKeys(credentials.email);

  // 5. Enter password
  const passwordInput = await waitVisible(
    driver,
    By.xpath("//label[contains(., 'Password')]/following::input[1]")
  );
  await passwordInput.clear();
  await passwordInput.sendKeys(credentials.password);

  // 6. Enter confirm password
  const confirmPasswordInput = await waitVisible(
    driver,
    By.xpath("//label[contains(., 'Confirm Password')]/following::input[1]")
  );
  await confirmPasswordInput.clear();
  await confirmPasswordInput.sendKeys(credentials.password);

  // 7. Tick terms and conditions checkbox
  const termsCheckbox = await waitClickable(
    driver,
    By.css('input[type="checkbox"]')
  );

  await driver.executeScript("arguments[0].click();", termsCheckbox);

  // 8. Click Sign Up button
  const signUpButton = await waitClickable(
    driver,
    By.xpath("//button[contains(., 'Sign Up')]")
  );

  await signUpButton.click();

  // 9. Verify successful registration redirects to login page
  await driver.wait(until.urlContains('/login'), DEFAULT_TIMEOUT);

  const currentUrl = await driver.getCurrentUrl();
  expect(currentUrl).toContain('/login');
}, 60000);

// Login test
test('login redirects user to product page', async () => {
  await createAccountAndLogin(driver, 'login');

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
  await createAccountAndLogin(driver, 'cart');
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
  // 1. Create a fresh account and login
  await createAccountAndLogin(driver, 'purchase');

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
  const credentials = await createAccountAndLogin(driver, 'reset');
  const updatedCredentials = {
    ...credentials,
    password: `${credentials.password}-new`,
  };

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
  await newPasswordInput.sendKeys(updatedCredentials.password);

  // 6. Enter confirm new password
  const confirmPasswordInput = await waitVisible(
    driver,
    By.css('input[name="confirmPassword"]')
  );

  await confirmPasswordInput.clear();
  await confirmPasswordInput.sendKeys(updatedCredentials.password);

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

  await driver.executeScript('sessionStorage.clear();');
  await login(driver, updatedCredentials);
  expect(await driver.getCurrentUrl()).toContain('/product');
}, 60000);

// Log out test
test('user can log out after login', async () => {
  // 1. Login first
  await createAccountAndLogin(driver, 'logout');

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
