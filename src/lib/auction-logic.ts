export const BIDDING_STAGES = Array.from({ length: 30 }, (_, i) => (i + 1) * 100);

export const TEAM_PURSE_LIMIT = 3000;
export const MAX_SQUAD_SIZE = 9;

export function getNextBid(currentBid: number): number {
    if (currentBid >= 3000) return currentBid;
    return (currentBid || 0) + 100;
}

export function getPurplePushp(bid: number): number | null {
    const map: Record<number, number> = {
        625: 1,
        1300: 2,
        2000: 3,
        2500: 4,
        3125: 5,
        3750: 6,
        4375: 7,
        5000: 8
    };
    return map[bid] || null;
}
