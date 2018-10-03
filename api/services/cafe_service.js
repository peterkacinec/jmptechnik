import { db } from '../helpers/db.mongo';
import {
  objectid,
  filterValues2mongo,
  createSearchItems,
  createFtsItems,
} from '../helpers/utils';
import { RESTErrorNotFound, RESTErrorConflict } from '../helpers/errors';

const dbCafes = () => db().collection('cafes');

export const CafeProjections = {
  publicProfile: () => {
    return {
      _id: true,
      name: true,
      description: true,
    };
  },
};

export async function searchCafes(
  limit,
  offset,
  { q, ids } = {},
  sorter = 'name',
  projection = CafeProjections.publicProfile(),
) {
  const filter = {};
  if (q && q.length) {
    try {
      const oid = objectid(q);
      filter._id = oid;
    } catch (e) {
      filter.fts = filterValues2mongo(createSearchItems(q), '$all');
    }
  }
  if (ids) {
    filter._id = filterValues2mongo(ids.map(a => objectid(a, false)));
  }

  let sorters = { _id: -1 };
  if (sorter === 'name') {
    sorters = { sorter: 1, _id: -1 };
  } else if (sorter === '-sorter') {
    sorters = { name: -1, _id: -1 };
  }

  const orgCursor = dbCafes().find(filter, {
    sort: sorters,
    skip: offset,
    limit: limit + 1,
    projection,
  });

  const total = await orgCursor.count();
  const organizations = await orgCursor.toArray();

  return {
    pager: {
      total: total,
      limit: limit,
      offset: offset,
      next_offset: organizations.length > limit ? offset + limit : null,
    },
    items: organizations.slice(0, limit),
  };
}

export async function getCafe(
  orgId,
  projection = CafeProjections.publicProfile(),
) {
  const organization = await dbCafes().findOne(
    {
      _id: objectid(orgId),
    },
    {
      projection,
    },
  );
  if (!organization) {
    throw new RESTErrorNotFound(
      'ORGANIZATION_NOT_FOUND',
      `Organization (${orgId}) was not found`,
    );
  }
  return organization;
}

export async function updateCafe(orgId, updateSet) {
  const finalUpdateSet = Object.assign({}, updateSet, {
    updated: new Date(),
  });
  const updateResult = await dbCafes().update(
    { _id: objectid(orgId) },
    {
      $set: finalUpdateSet,
    },
  );
  if (Object.v4k(updateResult, 'result.n', 0) === 0) {
    throw new RESTErrorNotFound(
      'ORGANIZATION_NOT_FOUND',
      `Organization (${orgId}) was not found`,
    );
  }
  return true;
}

export async function createCafe(data) {
  const insertData = Object.assign({}, data, {
    created_date: new Date(),
  });
  try {
    const insertResult = await dbCafes().insert(insertData);
    return insertResult.ops[0];
  } catch (e) {
    throw e;
  }
}
