from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    try:
        page.goto("http://localhost:3000")
        page.fill('input[type="email"]', 'admin@protasked.com')
        page.fill('input[type="password"]', 'password')
        page.click('button:has-text("Login")')
        page.wait_for_timeout(5000) # wait for 5 seconds
        page.screenshot(path="jules-scratch/verification/after_login.png")
        page.click('button:has-text("Schedules")')
        page.click('button:has-text("New Task Template")')
        page.click('select#repeatType')
        page.screenshot(path="jules-scratch/verification/repetition_options.png")
    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        browser.close()