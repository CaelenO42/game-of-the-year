import { describe, expect, test } from 'vitest';
import { safeNext } from '../src/redirect.js';

describe('safeNext', () => {
    test('accepts a valid same site url and returns it', () => {
        expect(safeNext('/user/caelen')).toBe('/user/caelen');
    });

    test.each([
        "/search?q=the%20legend%20of%20zelda",   // encoded space in a query
        "/search?q=pok%C3%A9mon",                // encoded non-ASCII character
        "/game/12-zelda?ref=a%26b",              // encoded & inside a value
        "/%09/google.com",                       // literal %09
    ])("accepts %s unchanged", (url) => {
        expect(safeNext(url)).toBe(url);
    });

    test.each(['//google.com', '/\\google.com', 'https://google.com', 'javascript:alert(1);', '', undefined, ['/a'], 42, '/\t/google.com'])(
        'rejects %s',
        (name) => {
            expect(safeNext(name)).toEqual('/');
        },
    );
});