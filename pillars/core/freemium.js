'use strict';

var FREE_LIMITS = { finance: 10, tasks: 15, knowledge: 5, habits: 5, goals: 3 };

export async function canCreateEntity(entityType, currentCount) {
    var auth = await import('../../ui/composites/auth.js');
    var isPremium = await auth.verifyPremiumStatus();
    if (isPremium) return true;
    var limit = FREE_LIMITS[entityType];
    return limit === undefined || currentCount < limit;
}

export function showPaywall() {
    import('../../core/composites/cloud-sync.js').then(function (mod) {
        mod.showPaywall('entity_limit');
    });
}
