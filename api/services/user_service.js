import moment from 'moment';
import { db } from '../helpers/db.mongo';
import { RESTErrorNotFound, RESTErrorConflict } from '../helpers/errors';
import {
  objectid,
  createSearchItems,
  filterValues2mongo,
  createFtsItems,
} from '../helpers/utils';
// import * as issfService from '../services/issf_service';

const dbUsers = () => db().collection('users');
const dbUsersDeleted = () => db().collection('users_deleted');
// const dbAppspace = () => db().collection('appspaces');

export const UserProjections = {
  publicProfile: () => {
    return {
      name: true,
      surname: true,
      email: true,
      phone: true,
      sex: true,
      username: true,
      // chyba password
    };
  },
};

export async function updateUser(userId, data, recreateFts = true) {
  try {
    const updateSet = Object.assign({}, data);
    if (recreateFts) {
      updateSet.fts = await createUserFulltextItems(data, userId);
    }
    const updateResult = await dbUsers().update(
      { _id: objectid(userId) },
      {
        $set: updateSet,
      },
    );
    if (Object.v4k(updateResult, 'result.n', 0) === 0) {
      throw new RESTErrorNotFound(
        'USER_NOT_FOUND',
        `User (${userId}) not found`,
      );
    }
    return true;
  } catch (e) {
    if (e.message.includes('users.$username_1')) {
      throw new RESTErrorConflict('DUPLICATED_USER', e.message);
    } else if (e.message.includes('users.$idnr_1')) {
      throw new RESTErrorConflict('DUPLICATED_IDNR', e.message);
    }
    throw e;
  }
}

async function createUserFulltextItems(data, userId = null) {
  const fields = ['name', 'surname', 'email', 'username', 'idnr'];
  const uid = userId ? userId.toString() : data._id;

  const shouldLoad = fields.filter(f => !(f in data)).length;

  let user = Object.assign({}, data);
  if (shouldLoad && uid) {
    const loadedUser = await getUserProfile(uid);
    user = Object.assign(loadedUser, user);
  }

  const fts = createFtsItems(fields.map(f => user[f]));
  if (uid) {
    fts.push(uid);
  }
  return fts;
}

export async function createUser(data) {
  try {
    const insertData = Object.assign({}, data, {
      created_datetime: new Date(),
    });
    const insertResult = await dbUsers().insertOne(insertData);
    // fulltext vytvorime
    const userId = insertResult.insertedId;
    await updateUser(userId, {}, true);
    return userId;
  } catch (e) {
    if (e.message.includes('users.$username_1')) {
      throw new RESTErrorConflict('DUPLICATED_USER', e.message);
    } else if (e.message.includes('users.$idnr_1')) {
      throw new RESTErrorConflict('DUPLICATED_IDNR', e.message);
    }
    throw e;
  }
}

export async function getUserProfile(
  userId,
  projection = UserProjections.publicProfile(),
  // ppo = null,
) {
  let f = { _id: objectid(userId) };
  // if (ppo) {
  //   f = Object.assign(f, _getPPOfilter(ppo));
  // }
  const user = await dbUsers().findOne(f, {
    projection: projection,
  });
  if (!user) {
    throw new RESTErrorNotFound('USER_NOT_FOUND', `User (${userId}) not found`);
  }
  return user;
}

export async function createMultiItem(userId, segment, data, ppo = null) {
  // doplnime _id
  const insertData = Object.assign({}, data, {
    _id: objectid(),
  });
  let f = { _id: objectid(userId) };
  if (ppo) {
    f = Object.assign(f, _getPPOfilter(ppo));
  }
  const updateResult = await dbUsers().update(f, {
    $push: { [segment]: insertData },
  });
  if (Object.v4k(updateResult, 'result.n', 0) === 0) {
    throw new RESTErrorNotFound('USER_NOT_FOUND', `User (${userId}) not found`);
  }
  return insertData._id;
}

export async function updateMultiItem(
  userId,
  segment,
  itemId,
  data,
  ppo = null,
) {
  // doplnime cas zmeny
  const updateData = Object.assign({}, data, {
    _id: objectid(itemId),
    updated: new Date(),
  });
  // pozor, toto updatne len v prvej urovni, ak je tam dalsia, tak treba osetrit, alebo najlepsie, nepouzivat
  const updateSet = Object.keys(updateData).reduce((result, k) => {
    return Object.assign(result, { [`${segment}.$.${k}`]: updateData[k] });
  }, {});
  let f = { _id: objectid(userId), [`${segment}._id`]: objectid(itemId) };
  if (ppo) {
    f = Object.assign(f, _getPPOfilter(ppo));
  }
  const updateResult = await dbUsers().update(f, {
    $set: updateSet,
  });
  if (Object.v4k(updateResult, 'result.n', 0) === 0) {
    throw new RESTErrorNotFound('USER_NOT_FOUND', `User (${userId}) not found`);
  }
  return true;
}

export async function getMultiItem(userId, segment, itemId, ppo = null) {
  let f = {
    _id: objectid(userId),
    [`${segment}._id`]: objectid(itemId),
  };
  if (ppo) {
    f = Object.assign(f, _getPPOfilter(ppo));
  }
  const data = await dbUsers().findOne(f, {
    projection: { [`${segment}.$`]: true },
  });
  if (data && data[segment].length === 1) {
    return data[segment][0];
  }
  throw new RESTErrorNotFound(
    'NOT_FOUND',
    `User's (${userId}) segment (${segment}) with _id (${itemId}) not found`,
  );
}

export async function getMultiItemsByIds(userId, segment, itemIds, ppo = null) {
  let f = {
    _id: objectid(userId),
  };
  if (ppo) {
    f = Object.assign(f, _getPPOfilter(ppo));
  }
  const data = await dbUsers()
    .aggregate([
      { $match: f },
      { $project: { [`${segment}`]: true } },
      { $unwind: `$${segment}` },
      {
        $match: {
          [`${segment}._id`]: filterValues2mongo(itemIds),
        },
      },
    ])
    .toArray();
  return data.map(i => i[segment]).reduce((result, i) => {
    return Object.assign(result, { [i._id]: i });
  }, {});
}

export async function deleteMultiItem(userId, segment, itemId) {
  const updateResult = await dbUsers().update(
    { _id: objectid(userId) },
    {
      $pull: { [`${segment}`]: { _id: objectid(itemId) } },
    },
  );
  if (Object.v4k(updateResult, 'result.nModified', 0) === 0) {
    throw new RESTErrorNotFound(
      'NOT_FOUND',
      `User's (${userId}) segment (${segment}) with _id (${itemId}) not found`,
    );
  }
  return true;
}

// export async function getUserGroups(userId, appId = null) {
//   const user = await getUserProfile(userId, { groups: true });
//   // znormalizujeme grupy - doplnime appId null, ak nema appId
//   const groups = Object.v4k(user, 'groups', []).map(g => {
//     if (typeof g === 'string') {
//       return {
//         app_id: null,
//         group: g,
//       };
//     }
//     return g;
//   });

//   if (appId) {
//     return groups.filter(g => g.app_id === appId || g.app_id === null);
//   }

//   return groups;
// }

// export async function registerGroup(userId, appId, group) {
//   const updateResult = await dbUsers().update(
//     { _id: objectid(userId) },
//     {
//       $addToSet: {
//         groups: {
//           app_id: appId,
//           group: group,
//         },
//       },
//     },
//   );
//   if (Object.v4k(updateResult, 'result.n', 0) === 0) {
//     throw new RESTErrorNotFound('USER_NOT_FOUND');
//   }
// }

// export async function deleteGroup(userId, appId, group) {
//   const updateResult = await dbUsers().update(
//     { _id: objectid(userId) },
//     {
//       $pull: {
//         groups: {
//           app_id: appId,
//           group: group,
//         },
//       },
//     },
//   );
//   if (Object.v4k(updateResult, 'result.n', 0) === 0) {
//     throw new RESTErrorNotFound('USER_NOT_FOUND');
//   }
//   // zmazeme aj string (spatna kompatibilita)
//   if (!appId) {
//     await dbUsers().update(
//       { _id: objectid(userId) },
//       {
//         $pull: {
//           groups: group,
//         },
//       },
//     );
//   }
// }

// export async function getAddresses(userId, type = null) {
//   const user = await getUserProfile(userId, { addresses: true });
//   if (!user) {
//     throw new RESTErrorNotFound('USER_NOT_FOUND', `User (${userId}) not found`);
//   }
//   const items = Object.v4k(user, 'addresses', []);
//   if (type) {
//     return items.filter(i => {
//       return type.includes(i.type);
//     });
//   }
//   return items;
// }

// export async function getMultiItems(userId, segment, ppo = null) {
//   const user = await getUserProfile(userId, { [segment]: true }, ppo);
//   if (!user) {
//     throw new RESTErrorNotFound('USER_NOT_FOUND', `User (${userId}) not found`);
//   }
//   return Object.v4k(user, segment, []);
// }

// export async function getUserApps(userId, appId = null) {
//   const f = {
//     'users.user_id': objectid(userId),
//   };
//   if (appId) {
//     f.app_id = appId;
//   }
//   const data = await dbAppspace()
//     .find(f, {
//       projection: {
//         'users.$': true,
//         app_id: true,
//         app_space: true,
//         validTo: true,
//       },
//     })
//     .toArray();
//   const apps = data.reduce((result, appspace) => {
//     if (appspace && appspace.users && appspace.users.length) {
//       const newResult = Object.assign(
//         { [appspace.app_id]: { app_id: appspace.app_id, appspaces: [] } },
//         result,
//       );
//       newResult[appspace.app_id].appspaces.push({
//         app_id: appspace.app_id,
//         app_space: appspace.app_space,
//         validTo: appspace.validTo,
//         display_name: appspace.users[0].display_name,
//         role: appspace.users[0].role,
//         grant: appspace.users[0].grant,
//         user_id: userId,
//       });
//       return newResult;
//     }
//     return result;
//   }, {});
//   return Object.values(apps);
// }

// export async function getUserAppSpaces(userId, appId) {
//   const apps = await getUserApps(userId, appId);
//   const app = apps.find(a => a.app_id === appId);
//   if (app) {
//     return app.appspaces;
//   }
//   return [];
// }

// export async function getUserAppSpace(userId, appId, appSpace) {
//   const f = {
//     app_id: appId,
//     app_space: appSpace,
//     'users.user_id': objectid(userId),
//   };
//   const data = await dbAppspace().findOne(f, {
//     projection: { 'users.$': true },
//   });
//   if (data && data.users && data.users.length) {
//     return data.users[0];
//   }
//   return null;
// }

// export async function getUserExternalProfiles(userId, includeUserInfo = false) {
//   const f = { _id: objectid(userId) };
//   const user = await dbUsers().findOne(f, {
//     projection: { external_profile: true },
//   });
//   if (!user) {
//     throw new RESTErrorNotFound('USER_NOT_FOUND', `User (${userId}) not found`);
//   }
//   if (user.external_profile) {
//     return Object.keys(user.external_profile).map(externalService => {
//       const ret = {
//         external_service: externalService,
//         user_info_update:
//           user.external_profile[externalService].user_info_update || null,
//       };
//       if (includeUserInfo) {
//         ret.user_info = user.external_profile[externalService].user_info;
//       }
//       return ret;
//     });
//   }
//   return user.external_profile || [];
// }

// async function getUserExternalProfileData(userId, externalService) {
//   const f = { _id: objectid(userId) };
//   const user = await dbUsers().findOne(f, {
//     projection: { [`external_profile.${externalService}`]: true },
//   });
//   if (!user) {
//     throw new RESTErrorNotFound('USER_NOT_FOUND', `User (${userId}) not found`);
//   }
//   const profile = Object.v4k(user, `external_profile.${externalService}`, null);
//   if (!profile) {
//     throw new RESTErrorNotFound(
//       'EXTERNAL_PROFILE_NOT_FOUND',
//       `User has not external profile (${externalService})`,
//     );
//   }

//   // skontrolujeme platnost profilu, ak je neplatny, refreshneme
//   let shouldRefreshProfile = false;
//   if (!profile.user_info || !profile.user_info_update) {
//     shouldRefreshProfile = true;
//   } else if (
//     moment(profile.user_info_update)
//       .add(5, 'minutes')
//       .isBefore(new Date())
//   ) {
//     shouldRefreshProfile = true;
//   }
//   if (shouldRefreshProfile && profile.auth_token) {
//     if (externalService === 'issf') {
//       const { userInfo, tokenInfo } = await issfService.getIssfUserInfo(
//         profile.auth_token,
//       );
//       const newProfile = await setUserIssfProfile(userId, userInfo, tokenInfo);
//       return newProfile;
//     }
//   }

//   return profile;
// }

// export async function getUserExternalProfile(userId, externalService) {
//   const profile = await getUserExternalProfileData(userId, externalService);

//   return {
//     external_service: externalService,
//     user_info_update: profile.user_info_update,
//     user_info: profile.user_info,
//   };
// }

// export async function getUserExternalProfileToken(userId, externalService) {
//   const profile = await getUserExternalProfileData(userId, externalService);
//   return {
//     access_token: Object.v4k(profile, 'auth_token.access_token'),
//     token_type: Object.v4k(profile, 'auth_token.token_type'),
//   };
// }

// export async function deleteUserExternalProfile(userId, externalService) {
//   const updateResult = await dbUsers().update(
//     { _id: objectid(userId) },
//     {
//       $unset: { [`external_profile.${externalService}`]: true },
//     },
//   );
//   if (Object.v4k(updateResult, 'result.nModified', 0) === 0) {
//     throw new RESTErrorNotFound(
//       'NOT_FOUND',
//       `User's (${userId}) external profile (${externalService}) not found`,
//     );
//   }
//   return true;
// }

// export async function setUserIssfProfile(userId, userInfo, tokenInfo) {
//   // ziskame si user info
//   const {
//     additionalAttributes: { registrationNumber: externalId },
//   } = userInfo;

//   return setUserExternalProfile(
//     userId,
//     'issf',
//     externalId || userInfo.username,
//     tokenInfo,
//     userInfo,
//   );
// }

// export async function setUserExternalProfile(
//   userId,
//   externalService,
//   externalId,
//   externalToken,
//   externalUserInfo,
// ) {
//   try {
//     const profileData = {
//       user_info_update: new Date(),
//       external_id: externalId,
//       user_info: externalUserInfo,
//       auth_token: externalToken,
//     };
//     await dbUsers().update(
//       { _id: objectid(userId) },
//       {
//         $set: {
//           [`external_profile.${externalService}`]: profileData,
//         },
//       },
//     );
//     return profileData;
//   } catch (e) {
//     if (e.message.includes('external_id_1')) {
//       throw new RESTErrorConflict('DUPLICATED_ISSF', null, {
//         message: e.message,
//       });
//     }
//     throw e;
//   }
// }

// export async function getSportOrgs(userId, itemId = null, ppo = null) {
//   let sportOrgs = [];
//   if (itemId) {
//     const sportOrg = await getMultiItem(userId, 'sport_orgs', itemId, ppo);
//     sportOrgs = [sportOrg];
//   } else {
//     sportOrgs = await getMultiItems(userId, 'sport_orgs', ppo);
//   }
//   // doplnime org_name, org_profile_name
//   const orgIds = sportOrgs.map(i => {
//     return i.org_id;
//   });
//   const orgProfileIds = sportOrgs.map(i => {
//     return i.org_profile_id;
//   });

//   if (orgIds && orgProfileIds) {
//     const orgNames = await getOrganizationNames(orgIds);
//     const orgProfileNames = await getOrganizationProfileNames(orgProfileIds);
//     sportOrgs = sportOrgs.map(o => {
//       return Object.assign(o, {
//         org_name: orgNames[o.org_id],
//         org_profile_name: orgProfileNames[o.org_profile_id],
//       });
//     });
//   }

//   return itemId ? sportOrgs[0] : sportOrgs;
// }

// export async function getSportExpertOrgs(userId, itemId = null, ppo = null) {
//   let sportOrgs = [];
//   if (itemId) {
//     const sportOrg = await getMultiItem(
//       userId,
//       'sport_expert_orgs',
//       itemId,
//       ppo,
//     );
//     sportOrgs = [sportOrg];
//   } else {
//     sportOrgs = await getMultiItems(userId, 'sport_expert_orgs', ppo);
//   }

//   // doplnime licencie
//   const licenses = await getMultiItemsByIds(userId, 'sport_expert_licenses', [
//     ...new Set(sportOrgs.map(i => i.license_id)),
//   ]);
//   const sportOrgsWithLicense = sportOrgs.map(i => {
//     return Object.assign({}, i, { license: licenses[i.license_id] });
//   });

//   return itemId ? sportOrgsWithLicense[0] : sportOrgsWithLicense;
// }

// function _getPPOfilter(ppo) {
//   return {
//     $or: [
//       { 'sport_orgs.org_profile_id': ppo },
//       { 'sport_expert_orgs.org_profile_id': ppo },
//     ],
//   };
// }

export async function searchUsers(
  limit,
  offset,
  {
    q,
    email,
    username,
    ids,
  } = {},
  sorter = 'person',
  projection = UserProjections.publicProfile(),
) {
  const filter = {};
  if (q && q.length) {
    try {
      const oid = objectid(q);
      filter._id = oid;
    } catch (e) {
      filter.$or = [
        { fts: filterValues2mongo(createSearchItems(q), '$all') },
        {
          'external_profile.issf.user_info.additionalAttributes.managerClubInfo.ico': q,
        },
      ];
    }
  }
  if (email) {
    filter.email = email.toLowerCase();
  }
  if (username) {
    filter.username = username;
  }
  if (importId) {
    filter.import_id = importId;
  }
  if (externalId) {
    filter.external_id = externalId;
  }
  if (dajmespolugol) {
    const dsgProfileIds = await getDsgOrgProfileIds(orgProfileId);
    filter['sport_orgs.org_profile_id'] = { $in: dsgProfileIds };
  }
  // filtre pre ppo
  if (ppo) {
    const and = [];
    and.push(_getPPOfilter(ppo));
    if (athletType) {
      and.push({
        $or: athletType.map(t => {
          return {
            sport_orgs: {
              $elemMatch: { org_profile_id: ppo, competence_type: t },
            },
          };
        }),
      });
    }
    if (sportExpertType) {
      and.push({
        $or: sportExpertType.map(t => {
          return {
            sport_expert_orgs: {
              $elemMatch: { org_profile_id: ppo, competence_type: t },
            },
          };
        }),
      });
    }

    // pridame and filter do filtrov
    filter.$and = and;
  }
  if (ids) {
    filter._id = filterValues2mongo(ids.map(a => objectid(a, false)));
  }

  let sorters = { _id: -1 };
  if (sorter === 'person') {
    sorters = { surname: 1, name: 1, _id: -1 };
  } else if (sorter === '-person') {
    sorters = { surname: -1, name: -1, _id: -1 };
  } else if (sorter === 'created_datetime') {
    sorters = { _id: 1 };
  } else if (sorter === '-created_datetime') {
    sorters = { _id: -1 };
  }

  const usersCursor = dbUsers().find(filter, {
    sort: sorters,
    skip: offset,
    limit: limit + 1,
    projection,
  });

  const total = await usersCursor.count();
  const users = await usersCursor.toArray();

  return {
    pager: {
      total: total,
      limit: limit,
      offset: offset,
      next_offset: users.length > limit ? offset + limit : null,
    },
    users: users.slice(0, limit),
  };
}

export async function deleteUser(userId) {
  const current = await dbUsers().findOne({ _id: objectid(userId) });
  if (!current) {
    throw new RESTErrorNotFound('NOT_FOUND', `User (${userId}) not found`);
  }
  await dbUsersDeleted().insert({ deleted_date: new Date(), data: current });
  const deleteResult = await dbUsers().deleteOne({ _id: objectid(userId) });
  if (Object.v4k(deleteResult, 'result.n', 0) === 0) {
    throw new RESTErrorNotFound('NOT_FOUND', `Delete user (${userId}) failed`);
  }
  return true;
}
