import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import * as itemsApi from '$lib/api/items';

// Disable prerendering for this dynamic route
export const prerender = false;

export const load: PageLoad = async ({ params }) => {
    const itemId = params.id;

    if (!itemId) {
        throw error(404, 'Article not found');
    }

    try {
        // Fetch the item details
        const item = await itemsApi.getItemById(itemId);

        if (!item) {
            throw error(404, 'Article not found');
        }

        return {
            item
        };
    } catch (err) {
        console.error('Failed to load article:', err);
        throw error(500, 'Failed to load article');
    }
};
