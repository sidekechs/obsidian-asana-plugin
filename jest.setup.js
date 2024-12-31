// Add any global test setup here
require('@testing-library/jest-dom');

// Mock DOM environment
class DOMElement {
    children = [];
    style = {};
    classList = {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn()
    };
    addEventListener = jest.fn();
    removeEventListener = jest.fn();
    appendChild = jest.fn();
    setAttribute = jest.fn();
    getAttribute = jest.fn();
    removeAttribute = jest.fn();
    querySelector = jest.fn();
    querySelectorAll = jest.fn();
    closest = jest.fn();
    remove = jest.fn();
}

global.document = {
    createElement: jest.fn(() => new DOMElement()),
    createTextNode: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    body: new DOMElement()
};

global.window = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    getComputedStyle: jest.fn(() => ({
        getPropertyValue: jest.fn()
    })),
    setInterval: jest.fn(),
    clearInterval: jest.fn()
};

global.HTMLElement = DOMElement;
global.HTMLDivElement = DOMElement;
global.HTMLSpanElement = DOMElement;
global.HTMLInputElement = DOMElement;
global.HTMLButtonElement = DOMElement;
global.HTMLTextAreaElement = DOMElement;
global.Element = DOMElement;
global.Event = jest.fn();
