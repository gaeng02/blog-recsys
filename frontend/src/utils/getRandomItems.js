export function getRandomItems(items, excludeId, count = 3) {
    return items
        .filter(item => item.id !== excludeId)
        .sort(() => Math.random() - 0.5)    
        .slice(0, count); 
}