export function slugify(name: string):string {
    return name
        .toString()
        .normalize("NFD")
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}