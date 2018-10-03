import * as reklamaciaService from '../services/reklamacia_service';
import { schema2projection } from '../helpers/utils';
import { RESTErrorNotFound, RESTErrorConflict } from '../helpers/errors';

export async function getReklamacie(req, res, next) {
  try {
    const { items, pager } = await reklamaciaService.searchReklamacie(
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

export async function updateReklamacia(req, res, next) {
  try {
    await reklamaciaService.updateReklamacia(
      req.swagger.params.reklamaciaId.value,
      req.swagger.params.data.value,
    );
    const organization = await reklamaciaService.getReklamacia(
      req.swagger.params.reklamaciaId.value,
      schema2projection(req.swagger.operation.responses[200].schema),
    );
    res.json(organization);
  } catch (e) {
    next(e);
  }
}

export async function getReklamacia(req, res, next) {
  try {
    console.log('nieco: ', req.swagger.operation.responses[200].schema);
    const organization = await reklamaciaService.getReklamacia(
      req.swagger.params.reklamaciaId.value,
      schema2projection(req.swagger.operation.responses[200].schema),
    );
    res.json(organization);
  } catch (e) {
    next(e);
  }
}

export async function createReklamacia(req, res, next) {
  try {
    // console.log('xxx: ', req.swagger.params.data.value);
    const createdOrg = await reklamaciaService.createReklamacia(req.swagger.params.data.value);
    res.json(createdOrg);
  } catch (e) {
    next(e);
  }
}