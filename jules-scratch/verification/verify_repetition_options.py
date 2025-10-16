from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    try:
        page.goto("http://localhost:3000")
        page.fill('input[type="email"]', 'admin@protasked.com')
        page.fill('input[type="password"]', 'password')
        page.click('button:has-text("Login")')
        expect(page).to_have_url("http://localhost:3000/")
        page.click('button:has-text("New Task Template")')
        page.click('select#repeatType')
        page.screenshot(path="jules-scratch/verification/repetition_options.png")
    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        browser.close()