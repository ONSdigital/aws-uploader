import Logger from "logger.js";
import { describe } from "node:test";

describe("Logger")

describe('Logger', () => {
    let logger;
    let consoleErrorSpy;
    let consoleLogSpy;
 
    beforeEach(() => {
        logger = new Logger();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });
 
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("logError method should return an erorr message", () => {
        const errorMessage = "Error Yo";
        logger.logError(errorMessage);
        expect(consoleErrorSpy).toHaveBeenCalledWith("Error: ${errorMessage}");
    });
}); 