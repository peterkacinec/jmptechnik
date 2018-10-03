import * as cafeService from '../services/cafe_service';
import { schema2projection } from '../helpers/utils';
import { RESTErrorNotFound, RESTErrorConflict } from '../helpers/errors';

export async function getCafes(req, res, next) {
  try {
    const { items, pager } = await cafeService.searchCafes(
      req.swagger.params.limit.value,
      req.swagger.params.offset.value,
      {
        q: req.swagger.params.q.value,
        ids: req.swagger.params.ids.value,
      },
      req.swagger.params.sorter.value,
      schema2projection(req.swagger.operation.responses[200].schema, 'items'),
    );
    res.json(Object.assign(pager, { items }));
  } catch (e) {
    next(e);
  }
}

export async function updateCafe(req, res, next) {
  try {
    await cafeService.updateCafe(
      req.swagger.params.cafeId.value,
      req.swagger.params.data.value,
    );
    const organization = await cafeService.getCafe(
      req.swagger.params.cafeId.value,
      schema2projection(req.swagger.operation.responses[200].schema),
    );
    res.json(organization);
  } catch (e) {
    next(e);
  }
}

export async function getCafe(req, res, next) {
  try {
    console.log('nieco: ', req.swagger.operation.responses[200].schema);
    const organization = await cafeService.getCafe(
      req.swagger.params.cafeId.value,
      schema2projection(req.swagger.operation.responses[200].schema),
    );
    res.json(organization);
  } catch (e) {
    next(e);
  }
}

export async function createCafe(req, res, next) {
  try {
    // console.log('xxx: ', req.swagger.params.data.value);
    const createdOrg = await cafeService.createCafe(req.swagger.params.data.value);
    res.json(createdOrg);
  } catch (e) {
    next(e);
  }
}