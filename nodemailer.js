const nodemailer = require('nodemailer');
const xoauth2 = require('xoauth2');
const config = require('./config.json');
// create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    xoauth2: xoauth2.createXOAuth2Generator({
      user: 'zpiao1@gmail.com',
      clientId: config.nodeMailerClientId,
      clientSecret: config.nodeMailerClientSecret,
      refreshToken: config.nodeMailerRefreshToken
    })
  }
});

exports.sendEmail = (to, url, callback) => {
  console.log(to);
  console.log(url);
  const mailOptions = {
    from: `"Zhao Jingyi" <zpiao1@gmail.com>`,
    to: to,
    subject: 'Authenticate your email with Excited!',
    text: 'Thank you for registering with Excited!',
    html: `<h1>Thank you for registering with Excited!</h1><p>You are one step from completing your registration!</p><p>Click the link below to authenticate your email account:<a href="${url}">${url}</a></p><p>Please ignore the email if did not register an account with <em>Excited!</em></p><p>Thank you very much!</p><p>Regards,</p><p>Zhao Jingyi</p>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    callback(err, info);
  });
};

