require('dotenv').config();
const {parse, stringify} = require('csv/sync');
const fs = require('fs');

const fileName = process.argv.length > 2 ? process.argv[2] : undefined;

async function fetchProducts() {
    let products = [];
    let moreProducts = true;
    let page = 1;

    async function fetchNextProducts() {
        // Fetch next page
        const projectsRes = await fetch(`https://cms.holoen.fans/api/fanmerch?depth=0&limit=100&page=${page}&depth=0`, {
            headers: {
                'X-RateLimit-Bypass': process.env.PAYLOAD_BYPASS_RATE_LIMIT_KEY ?? undefined,
                Authorization: process.env.PAYLOAD_API_KEY ? `users API-Key ${process.env.PAYLOAD_API_KEY}` : undefined,
            },
        });
        const body = await projectsRes.json();

        products = products.concat(body.docs);

        // Set variables for next fetch
        page += 1;
        moreProducts = body.hasNextPage;
    }

    while (moreProducts) {
        // eslint-disable-next-line no-await-in-loop
        await fetchNextProducts();
    }

    return products;
}

async function updateCSV() {
    const fileData = fs.readFileSync(fileName);

    const data = parse(fileData, {
        columns: true,
    });

    const products = (await fetchProducts()).filter((product) => product.price && product.price > 0);

    for (const product of products) {
        const idx = data.findIndex((row) => row.SKU === product.id);

        if (idx === -1) {
            data.push({
                'Item name': product.name,
                Variations: '',
                'Option set 1': '',
                'Option 1': '',
                'Option set 2': '',
                'Option 2': '',
                'Option set 3': '',
                'Option 3': '',
                'Option set 4': '',
                'Option 4': '',
                'Is variation visible? (Yes/No)': 'Yes',
                Price: product.price,
                'On sale in Online Store?': '',
                'Regular price (before sale)': '',
                'Tax rate (%)': '',
                'Track inventory? (Yes/No)': 'No',
                Quantity: product.quantity,
                SKU: product.id,
                Barcode: '',
                'Description (Online Store and Invoices only)': product.description,
                Category: product.category[0].toUpperCase() + product.category.slice(1),
                'Display colour in POS checkout': 'Light red',
                'Image 1': product.thumbnail ? product.thumbnail.url : '',
                'Image 2': '',
                'Image 3': '',
                'Image 4': '',
                'Image 5': '',
                'Image 6': '',
                'Image 7': '',
                'Display item in Online Store? (Yes/No)': 'No',
                'SEO title (Online Store only)': '',
                'SEO description (Online Store only)': '',
                'Shipping weight [kg] (Online Store only)': '',
                'Item id (Do not change)': '',
                'Variant id (Do not change)': ''
            });
        } else {
            data[idx] = {
                ...data[idx],
                'Item name': product.name,
                Price: product.price || 0,
                'Description (Online Store and Invoices only)': product.description,
                Category: product.category[0].toUpperCase() + product.category.slice(1),
                'Image 1': product.thumbnail ? product.thumbnail.url : '',
            }

            if (typeof data[idx].Quantity === 'number') {
                try {
                    await fetch(`https://cms.holoen.fans/api/fanmerch/${product.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            quantity: product.quantity,
                        }),
                        headers: {
                            'Content-Type': 'application/json',
                            'X-RateLimit-Bypass': process.env.PAYLOAD_BYPASS_RATE_LIMIT_KEY ?? undefined,
                            Authorization: process.env.PAYLOAD_API_KEY ? `users API-Key ${process.env.PAYLOAD_API_KEY}` : undefined,
                       },
                    });
                } catch {
                    console.log(`Failed updating stock in CMS for ${product.id}`);
                }
            }
        }
    }

    fs.writeFileSync(fileName, stringify(data, {
        header: true
    }));
}

async function createNewCSV() {
    const products = (await fetchProducts()).filter((product) => product.price && product.price > 0);

    const productsCSV = products.map((product) => ({
        'Item name': product.name,
        Variations: '',
        'Option set 1': '',
        'Option 1': '',
        'Option set 2': '',
        'Option 2': '',
        'Option set 3': '',
        'Option 3': '',
        'Option set 4': '',
        'Option 4': '',
        'Is variation visible? (Yes/No)': 'Yes',
        Price: product.price || 0,
        'On sale in Online Store?': '',
        'Regular price (before sale)': '',
        'Tax rate (%)': '',
        'Track inventory? (Yes/No)': 'No',
        Quantity: product.quantity,
        SKU: product.id,
        Barcode: '',
        'Description (Online Store and Invoices only)': product.description,
        Category: product.category[0].toUpperCase() + product.category.slice(1),
        'Display colour in POS checkout': 'Light red',
        'Image 1': product.thumbnail ? product.thumbnail.url : '',
        'Image 2': '',
        'Image 3': '',
        'Image 4': '',
        'Image 5': '',
        'Image 6': '',
        'Image 7': '',
        'Display item in Online Store? (Yes/No)': 'No',
        'SEO title (Online Store only)': '',
        'SEO description (Online Store only)': '',
        'Shipping weight [kg] (Online Store only)': '',
        'Item id (Do not change)': '',
        'Variant id (Do not change)': ''
    }));

    const output = stringify(productsCSV, {
        header: true
    });

    fs.writeFileSync('./output.csv', output);
}

if (fileName) {
    updateCSV().then();
} else {
    createNewCSV().then();
}
