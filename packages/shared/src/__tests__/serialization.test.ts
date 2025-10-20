import { beforeAll, describe, expect, it } from 'vitest';
import { ApiSerializer, type SerializableDefinition } from '../api/serialization';

const reverse = (value: string): string => value.split('').reverse().join('');

describe('ApiSerializer', () => {
    it('serializes data by reversing the JSON output', () => {
        const payload = { message: 'hello', count: 3 };
        const serialized = ApiSerializer.serialize(payload);
        expect(serialized).toBe(reverse(JSON.stringify(payload)));

        const roundTrip = ApiSerializer.deserialize<typeof payload>(serialized);
        expect(roundTrip).toEqual(payload);
    });

    it('handles nested arrays and objects', () => {
        const payload = {
            list: [1, undefined, { nested: ['a', undefined, 'b'] }],
            flag: true,
            meta: { created: '2024-01-01T00:00:00.000Z', optional: undefined },
        };

        const serialized = ApiSerializer.serialize(payload);
        expect(serialized).toBe(reverse(JSON.stringify(payload)));

        const roundTrip = ApiSerializer.deserialize<typeof payload>(serialized);
        expect(roundTrip).toEqual(JSON.parse(JSON.stringify(payload)));
    });

    describe('registered types', () => {
        class CustomThing {
            constructor(
                public readonly id: string,
                public readonly label: string,
            ) {}
        }

        beforeAll(() => {
            const definition: SerializableDefinition<CustomThing> = {
                type: 'CustomThing',
                isType: (value: unknown): value is CustomThing => value instanceof CustomThing,
                serialize: (value: CustomThing) => ({
                    id: value.id,
                    label: value.label,
                }),
                deserialize: (payload: unknown): CustomThing => {
                    const data = payload as { id: string; label: string; };
                    return new CustomThing(data.id, data.label);
                },
            };

            try {
                ApiSerializer.register(definition);
            } catch {
                // Tests can re-run in watch mode; ignore duplicate registration.
            }
        });

        it('serializes and deserializes registered instances', () => {
            const payload = {
                thing: new CustomThing('id-123', 'Example'),
                other: 'value',
            };

            const serialized = ApiSerializer.serialize(payload);
            const roundTrip = ApiSerializer.deserialize<typeof payload>(serialized);

            expect(roundTrip.thing).toBeInstanceOf(CustomThing);
            expect(roundTrip.thing).toEqual(new CustomThing('id-123', 'Example'));
            expect(roundTrip.other).toBe('value');
        });
    });
});
