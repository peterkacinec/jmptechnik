import nodemailer from 'nodemailer';
import config from 'config';
import mustache from 'mustache';
import { db } from '../helpers/db.mongo';
import { RESTErrorNotFound } from '../helpers/errors';

const dbMailTemplates = () => db().collection('email_templates');

export const getMailTemplateById = async templateId => {
  const mailTemplate = await dbMailTemplates().findOne({ _id: templateId });
  if (!mailTemplate) {
    throw new RESTErrorNotFound(
      `MAIL_TEMPLATE_NOT_FOUND templateId: '${templateId}'`,
    );
  }
  return mailTemplate;
};

export const sendMail = async ({
  sender,
  to,
  subject,
  text,
  html,
  bcc = false,
}) => {
  // create reusable transporter object using the default SMTP transport
  const transporter = nodemailer.createTransport(
    config.has('mail.transportOverride')
      ? config.get('mail.transportOverride')
      : config.get('mail.transport'),
  );

  // send email
  const data = {
    sender,
    to,
    subject,
    text,
    html,
  };
  if (bcc) {
    data.bcc = bcc;
  }

  return new Promise((resolve, reject) => {
    transporter.sendMail(data, (error, info) => {
      if (error) {
        reject(error);
      } else {
        resolve(info);
      }
    });
  });
};

export const sendMailUsingTemplate = async (templateId, data) => {
  const mailTemplate = await getMailTemplateById(templateId);

  const mailData = {
    sender: {
      name: mustache.render(mailTemplate.from_name, data),
      address: mustache.render(mailTemplate.from, data),
    },
    to: [
      {
        name: mustache.render(mailTemplate.recipient_name, data),
        address: mustache.render(mailTemplate.recipient, data),
      },
    ],
    subject: mustache.render(mailTemplate.subject, data),
    text:
      mailTemplate.body_text && mustache.render(mailTemplate.body_text, data),
    html:
      mailTemplate.body_html && mustache.render(mailTemplate.body_html, data),
  };

  if (mailTemplate.bcc) {
    mailData.bcc = mustache.render(mailTemplate.bcc, data);
  }

  return sendMail(mailData);
};
