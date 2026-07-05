using Microsoft.EntityFrameworkCore;
using Whiteboard.Domain.Entities;

namespace Whiteboard.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Board> Boards => Set<Board>();
    public DbSet<BoardEvent> BoardEvents => Set<BoardEvent>();
    public DbSet<BoardPermission> BoardPermissions => Set<BoardPermission>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<BoardInvite> BoardInvites => Set<BoardInvite>();
    public DbSet<BoardSnapshot> BoardSnapshots => Set<BoardSnapshot>();

    public DbSet<BoardViolation> BoardViolations => Set<BoardViolation>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Email).HasMaxLength(256).IsRequired();
            entity.Property(e => e.DisplayName).HasMaxLength(128).IsRequired();
            entity.Property(e => e.PasswordHash).IsRequired();
        });

        builder.Entity<Board>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).HasMaxLength(256).IsRequired();
            
            entity.HasOne(e => e.Owner)
                  .WithMany(u => u.OwnedBoards)
                  .HasForeignKey(e => e.OwnerId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<BoardEvent>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.EventType).HasMaxLength(128).IsRequired();
            entity.Property(e => e.PayloadJson).IsRequired();
            
            entity.HasIndex(e => new { e.BoardId, e.SequenceNumber }).IsUnique();
            
            entity.HasIndex(e => new { e.BoardId, e.SequenceNumber });

            entity.HasOne(e => e.Board)
                  .WithMany(b => b.Events)
                  .HasForeignKey(e => e.BoardId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.User)
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Права в доске
        builder.Entity<BoardPermission>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            entity.HasIndex(e => new { e.BoardId, e.UserId }).IsUnique();

            entity.HasOne(e => e.Board)
                  .WithMany(b => b.Permissions)
                  .HasForeignKey(e => e.BoardId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.User)
                  .WithMany(u => u.Permissions)
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Token).IsUnique();
            entity.Property(e => e.Token).HasMaxLength(512).IsRequired();
    
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
    
            // Индекс для быстрого поиска активных токенов
            entity.HasIndex(e => new { e.UserId, e.ExpiresAt });
        });

        builder.Entity<BoardInvite>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.InviteToken).IsUnique();
            entity.Property(e => e.InviteToken).HasMaxLength(256).IsRequired();
    
            entity.HasOne(e => e.Board)
                .WithMany()
                .HasForeignKey(e => e.BoardId)
                .OnDelete(DeleteBehavior.Cascade);
    
            entity.HasOne(e => e.CreatedByUser)
                .WithMany()
                .HasForeignKey(e => e.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<BoardSnapshot>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.S3Key).HasMaxLength(512).IsRequired();
    
            entity.HasIndex(e => new { e.BoardId, e.SequenceNumber });
    
            entity.HasOne(e => e.Board)
                .WithMany()
                .HasForeignKey(e => e.BoardId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}