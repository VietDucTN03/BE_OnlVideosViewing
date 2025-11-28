const crypto = require("crypto");
const bcrypt = require("bcrypt");

const changeUserPassword = async ({ user, oldPassword, newPassword, isForgotMode, token }) => {

    if (!isForgotMode) {

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) throw new Error("Old password is incorrect");

        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) throw new Error("New password cannot be the same as old password");

    } else {

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        if (user.resetPasswordToken !== hashedToken || user.resetPasswordExpire < Date.now()) throw new Error("Invalid or expired reset token");
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

    }

    user.password = newPassword;  // * Hashed by the pre-save hook on the Models side.
    user.passwordChangedAt = Date.now();
    await user.save();

    return user;
};

module.exports = changeUserPassword;