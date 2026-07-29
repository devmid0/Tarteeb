'use strict';

export function canCreateEntity(entityType, currentCount) {
    if (localStorage.getItem('tarteeb_premium') === 'true') return true;
    var FREE_LIMITS = { finance: 10, tasks: 15, knowledge: 5, habits: 5, goals: 3 };
    var limit = FREE_LIMITS[entityType];
    return limit === undefined || currentCount < limit;
}

export function showPaywall() {
    import('../../core/composites/cloud-sync.js').then(function (mod) {
        mod.showPaywall();
    });
}
